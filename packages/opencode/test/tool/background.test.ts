import { afterEach, describe, expect } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Cause, Effect, Exit, Layer } from "effect"
import { BackgroundJob } from "@/background/job"
import {
  BackgroundKillTool,
  BackgroundListTool,
  BackgroundOutputTool,
  BackgroundStartTool,
} from "../../src/tool/background"
import { Config } from "@/config/config"
import { disposeAllInstances, provideInstance, testInstanceStoreLayer, tmpdirScoped } from "../fixture/fixture"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "@/tool/truncate"
import { SessionID, MessageID } from "../../src/session/schema"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Plugin } from "../../src/plugin"
import { testEffect } from "../lib/effect"
import { Tool } from "@/tool/tool"
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
  sessionID: SessionID.make("ses_test-background"),
  messageID: MessageID.make("msg_test"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

const tools = Effect.fn("BackgroundToolTest.tools")(function* () {
  const start = yield* (yield* BackgroundStartTool).init()
  const output = yield* (yield* BackgroundOutputTool).init()
  const kill = yield* (yield* BackgroundKillTool).init()
  const list = yield* (yield* BackgroundListTool).init()
  return { start, output, kill, list }
})

const runIn = <A, E, R>(directory: string, self: Effect.Effect<A, E, R>) => self.pipe(provideInstance(directory))

const node = process.execPath.replaceAll("\\", "/")

describe("tool.background", () => {
  it.live("runs a command to completion and exposes its output", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* runIn(
        dir,
        Effect.gen(function* () {
          const t = yield* tools()
          const started = yield* t.start.execute({ command: `"${node}" -e "console.log('hello-bg')"` }, ctx)
          const id = started.metadata.id as string
          expect(started.output).toContain(id)

          const done = yield* t.output.execute({ id, wait: 15000 }, ctx)
          expect(done.output).toContain("hello-bg")
          expect(done.output).toMatch(/status=(completed|error)/)
        }),
      )
    }),
  )

  it.live("streams live output from a running process and kills it", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* runIn(
        dir,
        Effect.gen(function* () {
          const t = yield* tools()
          const started = yield* t.start.execute(
            {
              command: `"${node}" -e "console.log('boot-marker'); setInterval(() => {}, 1000)"`,
              title: "fake server",
            },
            ctx,
          )
          const id = started.metadata.id as string

          // Poll until the boot marker shows up in the live buffer.
          const seen = yield* Effect.gen(function* () {
            const result = yield* t.output.execute({ id }, ctx)
            if (!result.output.includes("boot-marker")) return yield* Effect.fail(new Error("not yet"))
            return result
          }).pipe(Effect.retry({ times: 50, schedule: undefined }), Effect.orDie)
          expect(seen.output).toContain("status=running")

          const killed = yield* t.kill.execute({ id }, ctx)
          expect(killed.output).toContain("cancelled")

          const after = yield* t.output.execute({ id }, ctx)
          expect(after.output).toContain("status=cancelled")
        }),
      )
    }),
  )

  it.live("lists background processes and rejects unknown ids", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* runIn(
        dir,
        Effect.gen(function* () {
          const t = yield* tools()
          const empty = yield* t.list.execute({}, ctx)
          expect(empty.output).toContain("No background processes")

          const started = yield* t.start.execute({ command: `"${node}" -e "console.log('x')"` }, ctx)
          const id = started.metadata.id as string
          const listed = yield* t.list.execute({}, ctx)
          expect(listed.output).toContain(id)

          const exit = yield* t.output.execute({ id: "job_does_not_exist" }, ctx).pipe(Effect.exit)
          if (!Exit.isFailure(exit)) throw new Error("expected unknown id to fail")
          const err = Cause.squash(exit.cause)
          expect(String(err)).toContain("No background process found")
        }),
      )
    }),
  )
})
