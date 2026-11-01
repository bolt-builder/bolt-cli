import { describe, expect, test } from "bun:test"
import path from "node:path"
import { Option, Schema } from "effect"
import { Profile, aggregate, plan, render } from "@opencode/core/tool/plugin/profile"

const fixture = path.join(__dirname, "fixtures", "profile.cpuprofile")

async function load() {
  const parsed = Schema.decodeUnknownOption(Profile)(await Bun.file(fixture).json())
  if (Option.isNone(parsed)) throw new Error("fixture did not decode as a V8 CPU profile")
  return parsed.value
}

describe("profile.aggregate", () => {
  test("returns frames sorted by self time with totals including callees", async () => {
    const frames = aggregate(await load(), 10)
    expect(frames).toEqual([
      { name: "hot", location: "file:///app/main.ts:10", self: 4000, total: 4000 },
      { name: "cold", location: "file:///app/main.ts:20", self: 500, total: 500 },
      { name: "main", location: "file:///app/main.ts:1", self: 250, total: 4750 },
    ])
  })

  test("excludes V8 bookkeeping frames like (root) and (garbage collector)", async () => {
    const frames = aggregate(await load(), 10)
    expect(frames.map((frame) => frame.name)).not.toContain("(root)")
    expect(frames.map((frame) => frame.name)).not.toContain("(garbage collector)")
  })

  test("respects the frame limit", async () => {
    const frames = aggregate(await load(), 1)
    expect(frames).toHaveLength(1)
    expect(frames[0].name).toBe("hot")
  })

  test("merges nodes that share a function and location", () => {
    const frames = aggregate(
      {
        nodes: [
          { id: 1, callFrame: { functionName: "(root)", url: "", lineNumber: -1 }, children: [2, 3] },
          { id: 2, callFrame: { functionName: "work", url: "file:///a.ts", lineNumber: 4 }, children: [] },
          { id: 3, callFrame: { functionName: "work", url: "file:///a.ts", lineNumber: 4 }, children: [] },
        ],
        samples: [2, 3],
        timeDeltas: [100, 200],
      },
      10,
    )
    expect(frames).toEqual([{ name: "work", location: "file:///a.ts:5", self: 300, total: 300 }])
  })

  test("labels frames without a url as native", () => {
    const frames = aggregate(
      {
        nodes: [{ id: 1, callFrame: { functionName: "memcpy", url: "", lineNumber: -1 } }],
        samples: [1],
        timeDeltas: [50],
      },
      10,
    )
    expect(frames).toEqual([{ name: "memcpy", location: "(native)", self: 50, total: 50 }])
  })
})

describe("profile.plan", () => {
  test("injects the V8 profiler flags after the bun runtime token", () => {
    const planned = plan("bun ./scripts/bench.ts --flag", "/tmp/prof")
    expect(planned.kind).toBe("cpuprofile")
    expect(planned.command).toBe("bun --cpu-prof --cpu-prof-dir=/tmp/prof ./scripts/bench.ts --flag")
  })

  test("recognizes node by basename even with an absolute path", () => {
    const planned = plan("/usr/local/bin/node server.js", "/tmp/prof")
    expect(planned.kind).toBe("cpuprofile")
    expect(planned.command).toBe("/usr/local/bin/node --cpu-prof --cpu-prof-dir=/tmp/prof server.js")
  })

  test("falls back to /usr/bin/time for non-JS commands", () => {
    const planned = plan("cargo build --release", "/tmp/prof")
    expect(planned.kind).toBe("time")
    expect(planned.command).toBe("/usr/bin/time -v cargo build --release")
  })
})

describe("profile.render", () => {
  test("renders an aligned table with millisecond times", () => {
    const out = render([{ name: "hot", location: "file:///app/main.ts:10", self: 4000, total: 4000 }])
    const lines = out.split("\n")
    expect(lines[0]).toContain("self(ms)")
    expect(lines[1]).toContain("4.0")
    expect(lines[1]).toContain("hot")
    expect(lines[1]).toContain("file:///app/main.ts:10")
  })
})

import fs from "node:fs/promises"
import { Effect, Layer } from "effect"
import { Location } from "@opencode/core/location"
import { Plugin } from "@opencode/core/plugin"
import { Permission } from "@opencode/core/permission"
import { Session } from "@opencode/core/session"
import { Tool } from "@opencode/core/tool"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Database } from "@opencode/core/database/database"
import { Bus } from "@opencode/core/bus"
import { LocationServiceMap } from "@opencode/core/location-service-map"
import { AbsolutePath } from "@opencode/core/schema"
import { Global } from "@opencode/util/global"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { tempGlobalLayer } from "./fixture/global"
import { offlineModels } from "./fixture/models"
import { tmpdirScoped } from "./fixture/tmpdir"
import { executeTool, toolIdentity } from "./lib/tool"
import { permissionLayer } from "./lib/permission"
import { testEffect } from "./lib/effect"

const it = testEffect(Layer.empty)
it.live("profile captures a real CPU workload and preserves shell approval, timeout and cleanup", () =>
  Effect.gen(function* () {
    const temp = yield* tmpdirScoped()
    const directory = path.join(temp.path, "project with spaces")
    yield* Effect.promise(async () => {
      await fs.mkdir(directory)
      await Bun.write(
        path.join(directory, "workload.js"),
        "function burn() { const until = Date.now() + 40; let n = 0; while(Date.now() < until) n += Math.sqrt(n + 1); return n } console.log(burn())",
      )
      await Bun.write(path.join(directory, "pending.js"), "process.stdout.write('ready'); setInterval(() => {}, 1000)")
    })
    let denied = ""
    const actions: string[] = []
    const permission = permissionLayer({
      allows: () => Effect.succeed(false),
      assert: (input) =>
        Effect.sync(() => actions.push(input.action)).pipe(
          Effect.andThen(
            input.action === denied
              ? Effect.fail(
                  new Permission.BlockedError({ rules: [], permission: input.action, resources: input.resources }),
                )
              : Effect.void,
          ),
        ),
    })
    yield* Effect.gen(function* () {
      const locations = yield* LocationServiceMap.Service
      yield* Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        yield* plugin.awaitActivation
        const tools = yield* Tool.Service
        const sessions = yield* Session.Service
        const session = yield* sessions.create({
          location: { directory: AbsolutePath.make(directory) },
          agent: toolIdentity.agent,
        })
        const run = (input: Record<string, unknown>) =>
          executeTool(tools, {
            sessionID: session.id,
            ...toolIdentity,
            call: { type: "tool-call", id: "profile", name: "profile", input },
            progress: () => Effect.void,
          })
        const success = yield* run({ command: "node workload.js", duration: 10_000, limit: 5 })
        expect(success).toMatchObject({ status: "completed", output: { mode: "cpu-profile", exit: 0, timeout: false } })
        expect(success.output.frames.length).toBeGreaterThan(0)
        expect(success.output.frames.length).toBeLessThanOrEqual(5)
        expect(success.output.output).toContain("hot frames by self time")
        expect(yield* Effect.promise(() => fs.readdir(path.join(directory, ".bolt/tmp")))).toEqual([])
        const plain = yield* run({ command: "echo profiler-fallback", duration: 10_000 })
        expect(plain).toMatchObject({ status: "completed", output: { exit: 0, frames: [] } })
        expect(plain.output.output).toContain("profiler-fallback")
        denied = "shell"
        expect((yield* run({ command: "node workload.js" })).status).toBe("error")
        expect(yield* Effect.promise(() => fs.readdir(path.join(directory, ".bolt/tmp")))).toEqual([])
        denied = "profile"
        expect((yield* run({ command: "node workload.js" })).status).toBe("error")
        denied = ""
        const timeout = yield* run({ command: "node pending.js", duration: 200 })
        expect(timeout).toMatchObject({ status: "completed", output: { timeout: true } })
        expect(timeout.output.output).toContain("duration cap")
        expect(yield* Effect.promise(() => fs.readdir(path.join(directory, ".bolt/tmp")))).toEqual([])
        expect(actions).toContain("profile")
        expect(actions).toContain("shell")
      }).pipe(
        Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(directory) }))),
        Effect.scoped,
      )
    }).pipe(
      Effect.provide(
        AppNodeBuilder.build(LayerNode.group([Database.node, Bus.node, Session.node, LocationServiceMap.node]), [
          Permission.node.replace(permission),
          Global.node.replace(tempGlobalLayer),
          offlineModels,
        ]),
      ),
    )
  }),
)
