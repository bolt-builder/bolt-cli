import { describe, expect, test } from "bun:test"
import { args, seconds, spread } from "@opencode/core/tool/plugin/frames"

describe("frames.seconds", () => {
  test("parses plain seconds", () => {
    expect(seconds("90")).toBe(90)
    expect(seconds("12.5")).toBe(12.5)
    expect(seconds("0")).toBe(0)
  })

  test("parses minutes:seconds", () => {
    expect(seconds("1:30")).toBe(90)
    expect(seconds("0:05")).toBe(5)
    expect(seconds("10:00.5")).toBe(600.5)
  })

  test("parses hours:minutes:seconds", () => {
    expect(seconds("1:02:03.5")).toBe(3723.5)
    expect(seconds("2:00:00")).toBe(7200)
  })

  test("rejects out-of-range and malformed stamps", () => {
    expect(seconds("1:75")).toBeUndefined()
    expect(seconds("1:02:60")).toBeUndefined()
    expect(seconds("abc")).toBeUndefined()
    expect(seconds("-5")).toBeUndefined()
    expect(seconds("1:2:3:4")).toBeUndefined()
    expect(seconds("")).toBeUndefined()
  })
})

describe("frames.spread", () => {
  test("centers evenly spaced points in each slice", () => {
    expect(spread(10, 2)).toEqual([2.5, 7.5])
    expect(spread(9, 3)).toEqual([1.5, 4.5, 7.5])
  })

  test("avoids the very start and end of the video", () => {
    const points = spread(60, 4)
    expect(points[0]).toBeGreaterThan(0)
    expect(points[points.length - 1]).toBeLessThan(60)
  })

  test("returns nothing for empty or invalid inputs", () => {
    expect(spread(0, 3)).toEqual([])
    expect(spread(10, 0)).toEqual([])
    expect(spread(-1, 2)).toEqual([])
  })
})

describe("frames.args", () => {
  test("seeks before the input for fast keyframe extraction", () => {
    const built = args("/tmp/repro.mp4", 12.5, "/tmp/out/frame-001.png")
    expect(built.indexOf("-ss")).toBeLessThan(built.indexOf("-i"))
    expect(built[built.indexOf("-ss") + 1]).toBe("12.5")
    expect(built[built.indexOf("-i") + 1]).toBe("/tmp/repro.mp4")
  })

  test("extracts exactly one frame and overwrites the output", () => {
    const built = args("/tmp/repro.mp4", 5, "/tmp/out/frame-001.png")
    expect(built[built.indexOf("-frames:v") + 1]).toBe("1")
    expect(built).toContain("-y")
    expect(built[built.length - 1]).toBe("/tmp/out/frame-001.png")
  })
})

import fs from "node:fs/promises"
import path from "node:path"
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
// Real decoder coverage needs ffmpeg/ffprobe; helper and validation tests do not.
const liveFrames = Bun.which("ffmpeg") && Bun.which("ffprobe") ? it.live : it.live.skip
liveFrames(
  "frames extracts and reads real video stills, samples duration, reports partial failure and honors approvals",
  () =>
    Effect.gen(function* () {
      const temp = yield* tmpdirScoped()
      const directory = path.join(temp.path, "video project with spaces")
      const video = path.join(directory, "sample's video.mp4")
      yield* Effect.promise(async () => {
        await fs.mkdir(directory)
        const child = Bun.spawn(
          [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=blue:s=32x24:r=2:d=2",
            "-c:v",
            "mpeg4",
            "-y",
            video,
          ],
          { stdout: "pipe", stderr: "pipe" },
        )
        const [code, stderr] = await Promise.all([
          child.exited,
          new Response(child.stderr).text(),
          new Response(child.stdout).text(),
        ])
        if (code !== 0) throw new Error(`Could not create video fixture: ${stderr}`)
      })
      let denied = ""
      const permission = permissionLayer({
        allows: () => Effect.succeed(false),
        assert: (input) =>
          input.action === denied
            ? Effect.fail(
                new Permission.BlockedError({ rules: [], permission: input.action, resources: input.resources }),
              )
            : Effect.void,
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
          const run = (input: Record<string, unknown>, name = "frames") =>
            executeTool(tools, {
              sessionID: session.id,
              ...toolIdentity,
              call: { type: "tool-call", id: "frames", name, input },
              progress: () => Effect.void,
            })
          const explicit = yield* run({ video, timestamps: ["0:00", "9999"] })
          expect(explicit).toMatchObject({ status: "completed", metadata: { extracted: 1, failed: 1 } })
          expect(explicit.output.images).toHaveLength(1)
          expect(explicit.output.failures[0]).toContain("9999")
          const image = explicit.output.images[0]
          const bytes = yield* Effect.promise(() => Bun.file(image).bytes())
          expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
          expect((yield* run({ path: image }, "read")).status).toBe("completed")
          const sampled = yield* run({ video: path.basename(video), count: 2 })
          expect(sampled).toMatchObject({ status: "completed", metadata: { extracted: 2, failed: 0 } })
          expect(sampled.output.images).toHaveLength(2)
          const before = yield* Effect.promise(() => fs.readdir(path.join(directory, ".bolt/tmp")))
          for (const input of [
            { video, count: 1, timestamps: ["0"] },
            { video },
            { video, timestamps: ["bad"] },
            { video, count: 0 },
            { video: "missing.mp4", count: 1 },
          ])
            expect((yield* run(input)).status).toBe("error")
          for (const action of ["read", "frames", "shell"]) {
            denied = action
            expect((yield* run({ video, timestamps: ["0"] })).status).toBe("error")
            expect(yield* Effect.promise(() => fs.readdir(path.join(directory, ".bolt/tmp")))).toEqual(before)
          }
          denied = ""
          const failed = yield* run({ video, timestamps: ["9999"] })
          expect(failed).toMatchObject({ status: "completed", metadata: { extracted: 0, failed: 1 } })
          expect(yield* Effect.promise(() => fs.readdir(path.join(directory, ".bolt/tmp")))).toEqual(before)
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
