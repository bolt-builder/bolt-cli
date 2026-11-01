import { expect } from "bun:test"
import { Context, Effect, Schema } from "effect"
import { Agent } from "@opencode/core/agent"
import { Permission } from "@opencode/core/permission"
import { KV } from "@opencode/core/kv"
import { Plugin } from "@opencode/core/plugin"
import { Session } from "@opencode/core/session"
import { SessionMessage } from "@opencode/core/session/message"
import { Tool } from "@opencode/core/tool"
import { TaskTools } from "@opencode/core/tool/plugin/tasks"
import { Global } from "@opencode/util/global"
import { FSUtil } from "@opencode/util/fs-util"
import path from "node:path"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "./fixture"

const it = testEffect(PluginTestLayer)
it.live(
  "persists task graphs across tool snapshots, serializes creates and enforces terminal/blocker transitions",
  () =>
    Effect.gen(function* () {
      const plugins = yield* Plugin.Service
      const tools = yield* Tool.Service
      const kv = yield* KV.Service
      const services = Context.pick(
        KV.Service,
        Permission.Service,
        Global.Service,
        FSUtil.Service,
      )(yield* Effect.context<KV.Service | Permission.Service | Global.Service | FSUtil.Service>())
      yield* plugins.activate([
        {
          id: TaskTools.Plugin.id,
          revision: "1",
          effect: (ctx) => TaskTools.Plugin.effect(ctx).pipe(Effect.provide(services)),
        },
      ])
      yield* plugins.awaitActivation
      const sessionID = Session.ID.make("ses_tasks")
      const call = (name: string, input: unknown, id = sessionID) =>
        Effect.gen(function* () {
          const snapshot = yield* tools.snapshot()
          return yield* snapshot.execute({
            sessionID: id,
            agent: Agent.ID.make("build"),
            messageID: SessionMessage.ID.create(),
            call: { type: "tool-call", id: crypto.randomUUID(), name, input },
          })
        })
      const created = yield* Effect.forEach(
        Array.from({ length: 8 }, (_, index) => index),
        (index) => call("task_create", { subject: `Task ${index}` }),
        { concurrency: "unbounded" },
      )
      expect(new Set(created.map((result) => result.metadata?.id)).size).toBe(8)
      expect(yield* kv.get(`bolt.tasks.v1/${sessionID}`)).toHaveLength(8)
      yield* call("task_create", { subject: "After first", blockers: ["1"] })
      expect(JSON.stringify(yield* call("task_update", { id: "9", status: "completed" }).pipe(Effect.flip))).toContain(
        "incomplete blockers",
      )
      const listed = yield* call("task_list", {})
      expect(listed.metadata?.count).toBe(9)
      expect(listed.metadata?.tasks).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "9", blocked: ["1"] })]),
      )
      yield* call("task_update", { id: "1", status: "completed" })
      yield* call("task_update", { id: "9", status: "completed" })
      expect(JSON.stringify(yield* call("task_update", { id: "9", status: "pending" }).pipe(Effect.flip))).toContain(
        "cannot change status",
      )
      expect(JSON.stringify(yield* call("task_list", {}))).toContain("After first")
      expect(JSON.stringify(yield* call("task_list", {}, Session.ID.make("ses_other_tasks")))).toContain(
        "No tasks exist",
      )
      const stored = [{ invalid: true }] satisfies Schema.Json
      yield* kv.set(`bolt.tasks.v1/${sessionID}`, stored)
      yield* call("task_create", { subject: "Must not overwrite invalid persisted data" }).pipe(Effect.flip)
      expect(yield* kv.get(`bolt.tasks.v1/${sessionID}`)).toEqual(stored)
      const global = yield* Global.Service
      const fs = yield* FSUtil.Service
      const importedID = Session.ID.make("ses_legacy_tasks")
      const legacy = path.join(global.data, "storage", "session_task", `${importedID}.json`)
      const oldTasks = [{ id: "7", subject: "Retained legacy work", status: "pending", blockers: [] }]
      yield* fs.writeWithDirs(legacy, JSON.stringify(oldTasks))
      expect(JSON.stringify(yield* call("task_list", {}, importedID))).toContain("Retained legacy work")
      expect(yield* kv.get(`bolt.tasks.v1/${importedID}`)).toEqual(oldTasks)
      yield* call("task_create", { subject: "Next restored task" }, importedID)
      expect(yield* kv.get(`bolt.tasks.v1/${importedID}`)).toHaveLength(2)
      expect(yield* fs.readFileString(legacy)).toBe(JSON.stringify(oldTasks))
      const invalidID = Session.ID.make("ses_invalid_legacy_tasks")
      const invalid = path.join(global.data, "storage", "session_task", `${invalidID}.json`)
      yield* fs.writeWithDirs(invalid, "{invalid}")
      yield* call("task_create", { subject: "Must preserve malformed legacy data" }, invalidID).pipe(Effect.flip)
      expect(yield* kv.get(`bolt.tasks.v1/${invalidID}`)).toBeUndefined()
      expect(yield* fs.readFileString(invalid)).toBe("{invalid}")
    }),
)
