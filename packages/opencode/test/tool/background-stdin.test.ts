import { afterEach, describe, expect, test } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Cause, Effect, Exit, Layer } from "effect"
import { BackgroundJob } from "@/background/job"
import { BackgroundOutputTool, BackgroundStartTool, BackgroundStdinTool, payload } from "../../src/tool/background"
import { Config } from "@/config/config"
import { disposeAllInstances, provideInstance, testInstanceStoreLayer, tmpdirScoped } from "../fixture/fixture"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "@/tool/truncate"
import { SessionID, MessageID } from "../../src/session/schema"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Plugin } from "../../src/plugin"
import { testEffect } from "../lib/effect"
import { RuntimeFlags } from "@/effect/runtime-flags"

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
      BackgroundJob.node,
    ]),
  ),
  testInstanceStoreLayer,
)
const it = testEffect(layer)

afterEach(async () => {
  await disposeAllInstances()
})

const ctx = {
  sessionID: SessionID.make("ses_test-bg-stdin"),
  messageID: MessageID.make("msg_test"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

const tools = Effect.fn("BackgroundStdinToolTest.tools")(function* () {
  const start = yield* (yield* BackgroundStartTool).init()
  const output = yield* (yield* BackgroundOutputTool).init()
  const stdin = yield* (yield* BackgroundStdinTool).init()
  return { start, output, stdin }
})

const runIn = <A, E, R>(directory: string, self: Effect.Effect<A, E, R>) => self.pipe(provideInstance(directory))

const node = process.execPath.replaceAll("\\", "/")

describe("background.payload", () => {
  test("appends a newline by default", () => {
    expect(new TextDecoder().decode(payload("ping"))).toBe("ping\n")
  })

  test("appends a newline when enter is true", () => {
    expect(new TextDecoder().decode(payload("ping", true))).toBe("ping\n")
  })

  test("sends data as-is when enter is false", () => {
    expect(new TextDecoder().decode(payload("ping", false))).toBe("ping")
  })

  test("encodes multibyte text as utf-8", () => {
    const bytes = payload("héllo", false)
    expect(bytes.byteLength).toBe(6)
    expect(new TextDecoder().decode(bytes)).toBe("héllo")
  })

  test("preserves an existing trailing newline and still appends", () => {
    expect(new TextDecoder().decode(payload("line\n"))).toBe("line\n\n")
  })
})

describe("tool.background_stdin", () => {
  it.live("rejects unknown process ids", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* runIn(
        dir,
        Effect.gen(function* () {
          const t = yield* tools()
          const exit = yield* t.stdin.execute({ id: "job_does_not_exist", data: "hi" }, ctx).pipe(Effect.exit)
          if (!Exit.isFailure(exit)) throw new Error("expected unknown id to fail")
          expect(String(Cause.squash(exit.cause))).toContain("No background process found")
        }),
      )
    }),
  )

  it.live("rejects processes that have already exited", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* runIn(
        dir,
        Effect.gen(function* () {
          const t = yield* tools()
          const started = yield* t.start.execute({ command: `"${node}" -e "console.log('done')"` }, ctx)
          const id = started.metadata.id as string
          yield* t.output.execute({ id, wait: 15000 }, ctx)

          const exit = yield* t.stdin.execute({ id, data: "hi" }, ctx).pipe(Effect.exit)
          if (!Exit.isFailure(exit)) throw new Error("expected exited process to fail")
          expect(String(Cause.squash(exit.cause))).toContain("already exited")
        }),
      )
    }),
  )

  it.live("writes to a running process and reads the echo back", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* runIn(
        dir,
        Effect.gen(function* () {
          const t = yield* tools()
          const started = yield* t.start.execute(
            { command: `"${node}" -e "process.stdin.pipe(process.stdout)"`, title: "echo" },
            ctx,
          )
          const id = started.metadata.id as string

          const wrote = yield* t.stdin.execute({ id, data: "ping-marker" }, ctx)
          expect(wrote.output).toContain("12 bytes")

          const seen = yield* Effect.gen(function* () {
            const result = yield* t.output.execute({ id }, ctx)
            if (!result.output.includes("ping-marker")) return yield* Effect.fail(new Error("not yet"))
            return result
          }).pipe(Effect.retry({ times: 50, schedule: undefined }), Effect.orDie)
          expect(seen.output).toContain("ping-marker")
        }),
      )
    }),
  )
})
