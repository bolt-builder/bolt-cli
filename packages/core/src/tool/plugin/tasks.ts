export * as TaskTools from "./tasks.js"

import type { Context } from "@opencode/plugin/effect/plugin"
import { ToolFailure } from "@opencode/ai/effect"
import { Effect, Schema } from "effect"
import { KV } from "../../kv.js"
import { Permission } from "../../permission.js"
import { KeyedMutex } from "../../effect/keyed-mutex.js"
import path from "node:path"
import { Global } from "@opencode/util/global"
import { FSUtil } from "@opencode/util/fs-util"
import CREATE_DESCRIPTION from "./tasks-create.txt"
import UPDATE_DESCRIPTION from "./tasks-update.txt"
import LIST_DESCRIPTION from "./tasks-list.txt"

export const Status = Schema.Literals(["pending", "in_progress", "completed", "cancelled"])
export type Status = Schema.Schema.Type<typeof Status>

export type Info = {
  id: string
  subject: string
  description?: string
  status: Status
  blockers: readonly string[]
}

/** A blocker stops blocking once it is completed or cancelled. */
export function blocked(tasks: readonly Info[], task: Info) {
  return task.blockers.filter((id) => {
    const blocker = tasks.find((item) => item.id === id)
    if (!blocker) return false
    return blocker.status !== "completed" && blocker.status !== "cancelled"
  })
}

/** Validate and build a new task, assigning the next numeric id. */
export function create(
  tasks: readonly Info[],
  input: { subject: string; description?: string; blockers?: readonly string[] },
): { ok: true; task: Info } | { ok: false; reason: string } {
  if (!input.subject.trim()) return { ok: false, reason: "subject must not be empty" }
  const known = tasks.map((task) => task.id)
  const missing = (input.blockers ?? []).filter((id) => !known.includes(id))
  if (missing.length) return { ok: false, reason: `unknown blocker task ids: ${missing.join(", ")}` }
  const next = tasks.reduce((max, task) => Math.max(max, Number(task.id) || 0), 0) + 1
  return {
    ok: true,
    task: {
      id: String(next),
      subject: input.subject,
      ...(input.description === undefined ? {} : { description: input.description }),
      status: "pending",
      blockers: [...new Set(input.blockers ?? [])],
    },
  }
}

/**
 * Validate a task update and return the new task list. Enforces legal status
 * transitions (completed and cancelled are terminal), at most one in_progress
 * task, and completion only when every blocker is completed or cancelled.
 */
export function transition(
  tasks: readonly Info[],
  input: { id: string; subject?: string; description?: string; status?: Status; blockers?: readonly string[] },
): { ok: true; tasks: Info[] } | { ok: false; reason: string } {
  const current = tasks.find((task) => task.id === input.id)
  if (!current) {
    const known = tasks.map((task) => task.id).join(", ")
    return { ok: false, reason: `unknown task id "${input.id}" (known ids: ${known || "none"})` }
  }

  if (input.subject !== undefined && !input.subject.trim()) return { ok: false, reason: "subject must not be empty" }

  if (input.blockers) {
    if (input.blockers.includes(input.id)) return { ok: false, reason: `task ${input.id} cannot block itself` }
    const known = tasks.map((task) => task.id)
    const missing = input.blockers.filter((id) => !known.includes(id))
    if (missing.length) return { ok: false, reason: `unknown blocker task ids: ${missing.join(", ")}` }
  }

  const updated: Info = {
    ...current,
    subject: input.subject ?? current.subject,
    ...(input.description === undefined ? {} : { description: input.description }),
    status: input.status ?? current.status,
    blockers: input.blockers ? [...new Set(input.blockers)] : current.blockers,
  }

  if (input.status !== undefined && input.status !== current.status) {
    if (current.status === "completed" || current.status === "cancelled") {
      return { ok: false, reason: `task ${input.id} is ${current.status} and cannot change status` }
    }
    if (input.status === "in_progress") {
      const active = tasks.find((task) => task.status === "in_progress" && task.id !== input.id)
      if (active) {
        return {
          ok: false,
          reason: `task ${active.id} is already in_progress; only one task may be in_progress at a time`,
        }
      }
    }
    if (input.status === "completed") {
      const remaining = blocked(
        tasks.map((task) => (task.id === input.id ? updated : task)),
        updated,
      )
      if (remaining.length) {
        return { ok: false, reason: `task ${input.id} has incomplete blockers: ${remaining.join(", ")}` }
      }
    }
  }

  return { ok: true, tasks: tasks.map((task) => (task.id === input.id ? updated : task)) }
}

export function render(tasks: readonly Info[]) {
  if (tasks.length === 0) return "No tasks exist for this session."
  return tasks
    .map((task) => {
      const remaining = blocked(tasks, task)
      return [
        `[${task.id}] ${task.status}: ${task.subject}`,
        task.description ? `  description: ${task.description}` : undefined,
        task.blockers.length ? `  blockers: ${task.blockers.join(", ")}` : undefined,
        remaining.length ? `  blocked by: ${remaining.join(", ")}` : undefined,
      ]
        .filter((line): line is string => line !== undefined)
        .join("\n")
    })
    .join("\n")
}

const locks = KeyedMutex.makeUnsafe<string>()
const Task = Schema.Struct({
  id: Schema.String,
  subject: Schema.String,
  description: Schema.optional(Schema.String),
  status: Status,
  blockers: Schema.Array(Schema.String),
})
const Tasks = Schema.Array(Task)
export const CreateParameters = Schema.Struct({
  subject: Schema.String,
  description: Schema.optional(Schema.String),
  blockers: Schema.optional(Schema.Array(Schema.String)),
})
export const UpdateParameters = Schema.Struct({
  id: Schema.String,
  subject: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  status: Schema.optional(Status),
  blockers: Schema.optional(Schema.Array(Schema.String)),
})

export const Plugin = {
  id: "bolt.tool.tasks",
  effect: Effect.fn("TaskTools.Plugin")(function* (ctx: Context) {
    const kv = yield* KV.Service
    const permission = yield* Permission.Service
    const global = yield* Global.Service
    const fs = yield* FSUtil.Service
    const load = (sessionID: string) =>
      Effect.gen(function* () {
        const key = `bolt.tasks.v1/${sessionID}`
        const value = yield* kv.get(key)
        if (value !== undefined) return yield* Schema.decodeUnknownEffect(Tasks)(value)
        if (!/^[A-Za-z0-9_-]+$/.test(sessionID)) return [] as readonly Info[]
        const roots = [
          global.data,
          ...(path.basename(global.data) === "opencode" ? [path.join(path.dirname(global.data), "bolt")] : []),
        ]
        for (const root of roots) {
          const file = path.join(root, "storage", "session_task", `${sessionID}.json`)
          const text = yield* fs.readFileStringSafe(file)
          if (text === undefined) continue
          const tasks = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Tasks))(text)
          yield* kv.set(key, tasks)
          return tasks
        }
        return [] as readonly Info[]
      })
    yield* ctx.tool.transform((editor) => {
      editor.add({
        name: "task_create",
        options: { codemode: false },
        description: CREATE_DESCRIPTION,
        input: CreateParameters,
        output: Task,
        execute: (input, context) =>
          permission
            .assert({
              action: "task_create",
              resources: ["*"],
              save: ["*"],
              sessionID: context.sessionID,
              agent: context.agent,
              source: { type: "tool", messageID: context.messageID, id: context.id },
            })
            .pipe(
              Effect.andThen(
                locks.withLock(context.sessionID)(
                  Effect.gen(function* () {
                    const tasks = yield* load(context.sessionID)
                    const result = create(tasks, input)
                    if (!result.ok) return yield* Effect.fail(new Error(result.reason))
                    yield* kv.set(`bolt.tasks.v1/${context.sessionID}`, [...tasks, result.task])
                    return {
                      output: result.task,
                      content: `Created task ${result.task.id}: ${result.task.subject}`,
                      metadata: { id: result.task.id },
                    }
                  }),
                ),
              ),
              Effect.mapError(
                (error) =>
                  new ToolFailure({ message: error instanceof Error ? error.message : "Unable to create task", error }),
              ),
            ),
      })
      editor.add({
        name: "task_update",
        options: { codemode: false },
        description: UPDATE_DESCRIPTION,
        input: UpdateParameters,
        output: Task,
        execute: (input, context) =>
          permission
            .assert({
              action: "task_update",
              resources: [input.id],
              save: ["*"],
              sessionID: context.sessionID,
              agent: context.agent,
              source: { type: "tool", messageID: context.messageID, id: context.id },
            })
            .pipe(
              Effect.andThen(
                locks.withLock(context.sessionID)(
                  Effect.gen(function* () {
                    const tasks = yield* load(context.sessionID)
                    const result = transition(tasks, input)
                    if (!result.ok) return yield* Effect.fail(new Error(result.reason))
                    const task = result.tasks.find((task) => task.id === input.id)!
                    yield* kv.set(`bolt.tasks.v1/${context.sessionID}`, result.tasks)
                    return {
                      output: task,
                      content: `Task ${task.id} is now ${task.status}: ${task.subject}`,
                      metadata: { id: task.id, status: task.status },
                    }
                  }),
                ),
              ),
              Effect.mapError(
                (error) =>
                  new ToolFailure({ message: error instanceof Error ? error.message : "Unable to update task", error }),
              ),
            ),
      })
      editor.add({
        name: "task_list",
        options: { codemode: false },
        description: LIST_DESCRIPTION,
        input: Schema.Struct({}),
        output: Tasks,
        execute: (_input, context) =>
          permission
            .assert({
              action: "task_list",
              resources: ["*"],
              save: ["*"],
              sessionID: context.sessionID,
              agent: context.agent,
              source: { type: "tool", messageID: context.messageID, id: context.id },
            })
            .pipe(
              Effect.andThen(locks.withLock(context.sessionID)(load(context.sessionID))),
              Effect.map((tasks) => ({
                output: tasks,
                content: render(tasks),
                metadata: {
                  count: tasks.length,
                  tasks: tasks.map((task) => ({ ...task, blocked: blocked(tasks, task) })),
                },
              })),
              Effect.mapError((error) => new ToolFailure({ message: "Unable to list tasks", error })),
            ),
      })
    })
  }),
}
