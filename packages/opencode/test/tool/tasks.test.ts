import { afterEach, describe, expect, test } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Config } from "@/config/config"
import { Plugin } from "../../src/plugin"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { Storage } from "@/storage/storage"
import { Truncate } from "@/tool/truncate"
import { SessionID, MessageID } from "../../src/session/schema"
import { blocked, create, render, transition, TaskListTool, type Info } from "../../src/tool/tasks"
import { disposeAllInstances, provideInstance, testInstanceStoreLayer, tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const layer = Layer.mergeAll(
  LayerNode.compile(
    LayerNode.group([
      CrossSpawnSpawner.node,
      FSUtil.node,
      Plugin.node,
      Truncate.node,
      Config.node,
      Agent.node,
      RuntimeFlags.node,
      Storage.node,
    ]),
  ),
  testInstanceStoreLayer,
)
const it = testEffect(layer)

afterEach(async () => {
  await disposeAllInstances()
})

function task(id: string, status: Info["status"], blockers: string[] = []): Info {
  return { id, subject: `task ${id}`, status, blockers }
}

describe("create", () => {
  test("assigns the next numeric id", () => {
    const out = create([task("1", "pending"), task("2", "completed")], { subject: "new work" })
    expect(out).toEqual({
      ok: true,
      task: { id: "3", subject: "new work", status: "pending", blockers: [] },
    })
  })

  test("starts at id 1 for an empty list", () => {
    const out = create([], { subject: "first" })
    if (!out.ok) throw new Error(out.reason)
    expect(out.task.id).toBe("1")
  })

  test("keeps description and deduplicates blockers", () => {
    const out = create([task("1", "pending")], { subject: "s", description: "d", blockers: ["1", "1"] })
    if (!out.ok) throw new Error(out.reason)
    expect(out.task.description).toBe("d")
    expect(out.task.blockers).toEqual(["1"])
  })

  test("rejects unknown blockers", () => {
    const out = create([task("1", "pending")], { subject: "s", blockers: ["9"] })
    expect(out).toEqual({ ok: false, reason: "unknown blocker task ids: 9" })
  })

  test("rejects an empty subject", () => {
    expect(create([], { subject: "  " }).ok).toBe(false)
  })
})

describe("transition", () => {
  test("rejects unknown task ids", () => {
    const out = transition([task("1", "pending")], { id: "9", status: "completed" })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain('unknown task id "9"')
  })

  test("moves a pending task to in_progress", () => {
    const out = transition([task("1", "pending")], { id: "1", status: "in_progress" })
    if (!out.ok) throw new Error(out.reason)
    expect(out.tasks[0].status).toBe("in_progress")
  })

  test("enforces a single in_progress task", () => {
    const out = transition([task("1", "in_progress"), task("2", "pending")], { id: "2", status: "in_progress" })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain("task 1 is already in_progress")
  })

  test("allows in_progress when the other active task is the one updated", () => {
    const out = transition([task("1", "in_progress")], { id: "1", status: "in_progress" })
    expect(out.ok).toBe(true)
  })

  test("rejects completing a task with a pending blocker", () => {
    const out = transition([task("1", "pending"), task("2", "in_progress", ["1"])], { id: "2", status: "completed" })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain("incomplete blockers: 1")
  })

  test("rejects completing a task with an in_progress blocker", () => {
    const out = transition([task("1", "in_progress"), task("2", "pending", ["1"])], { id: "2", status: "completed" })
    expect(out.ok).toBe(false)
  })

  test("allows completion once blockers are completed", () => {
    const out = transition([task("1", "completed"), task("2", "in_progress", ["1"])], { id: "2", status: "completed" })
    expect(out.ok).toBe(true)
  })

  test("cancelled blockers no longer block", () => {
    const out = transition([task("1", "cancelled"), task("2", "pending", ["1"])], { id: "2", status: "completed" })
    expect(out.ok).toBe(true)
  })

  test("completed tasks are terminal", () => {
    const out = transition([task("1", "completed")], { id: "1", status: "pending" })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain("completed and cannot change status")
  })

  test("cancelled tasks are terminal", () => {
    const out = transition([task("1", "cancelled")], { id: "1", status: "in_progress" })
    expect(out.ok).toBe(false)
  })

  test("same-status update is a no-op, not an illegal transition", () => {
    const out = transition([task("1", "pending")], { id: "1", status: "pending" })
    expect(out.ok).toBe(true)
  })

  test("field updates without status keep the status", () => {
    const out = transition([task("1", "in_progress")], { id: "1", subject: "renamed" })
    if (!out.ok) throw new Error(out.reason)
    expect(out.tasks[0]).toMatchObject({ subject: "renamed", status: "in_progress" })
  })

  test("rejects a whitespace-only subject", () => {
    const out = transition([task("1", "pending")], { id: "1", subject: "   " })
    expect(out).toEqual({ ok: false, reason: "subject must not be empty" })
  })

  test("rejects self-blocking", () => {
    const out = transition([task("1", "pending")], { id: "1", blockers: ["1"] })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain("cannot block itself")
  })

  test("rejects unknown blocker ids", () => {
    const out = transition([task("1", "pending"), task("2", "pending")], { id: "2", blockers: ["7"] })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain("unknown blocker task ids: 7")
  })

  test("blockers updated in the same call are enforced for completion", () => {
    const out = transition([task("1", "pending"), task("2", "pending")], {
      id: "2",
      status: "completed",
      blockers: ["1"],
    })
    expect(out.ok).toBe(false)
  })

  test("only the targeted task changes", () => {
    const tasks = [task("1", "pending"), task("2", "pending")]
    const out = transition(tasks, { id: "2", status: "cancelled" })
    if (!out.ok) throw new Error(out.reason)
    expect(out.tasks[0]).toEqual(tasks[0])
    expect(out.tasks[1].status).toBe("cancelled")
  })
})

describe("blocked", () => {
  test("lists only unresolved blockers", () => {
    const tasks = [task("1", "completed"), task("2", "pending"), task("3", "pending", ["1", "2"])]
    expect(blocked(tasks, tasks[2])).toEqual(["2"])
  })

  test("ignores dangling blocker ids", () => {
    const item = task("1", "pending", ["9"])
    expect(blocked([item], item)).toEqual([])
  })
})

describe("task_list execute", () => {
  it.live("returns structured task records with live blocked info", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* Effect.gen(function* () {
        const storage = yield* Storage.Service
        const sessionID = SessionID.make(`ses_tasks-test-${crypto.randomUUID()}`)
        yield* Effect.addFinalizer(() => storage.remove(["session_task", sessionID]).pipe(Effect.ignore))
        const tasks = [task("1", "pending"), task("2", "pending", ["1"])]
        yield* storage.write(["session_task", sessionID], tasks)

        const info = yield* TaskListTool
        const def = yield* info.init()
        const result = yield* def.execute(
          {},
          {
            sessionID,
            messageID: MessageID.make("msg_tasks-test"),
            callID: "",
            agent: "build",
            abort: AbortSignal.any([]),
            messages: [],
            metadata: () => Effect.void,
            ask: () => Effect.void,
          },
        )

        expect(result.metadata.count).toBe(2)
        expect(result.metadata.tasks).toEqual([
          { ...tasks[0], blocked: [] },
          { ...tasks[1], blocked: ["1"] },
        ])
        expect(result.output).toContain("blocked by: 1")
      }).pipe(provideInstance(dir))
    }),
  )
})

describe("render", () => {
  test("reports an empty task list", () => {
    expect(render([])).toBe("No tasks exist for this session.")
  })

  test("includes status, blockers, and blocked-by info", () => {
    const tasks = [task("1", "pending"), { ...task("2", "pending", ["1"]), description: "detail" }]
    const out = render(tasks)
    expect(out).toContain("[1] pending: task 1")
    expect(out).toContain("[2] pending: task 2")
    expect(out).toContain("description: detail")
    expect(out).toContain("blockers: 1")
    expect(out).toContain("blocked by: 1")
  })
})
