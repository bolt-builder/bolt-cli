import { expect } from "bun:test"
import fs from "node:fs/promises"
import http from "node:http"
import path from "node:path"
import { Effect, Layer } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Database } from "@opencode/core/database/database"
import { Bus } from "@opencode/core/bus"
import { Environment } from "@opencode/core/environment/index"
import { Location } from "@opencode/core/location"
import { LocationServiceMap } from "@opencode/core/location-service-map"
import { Permission } from "@opencode/core/permission"
import { Plugin } from "@opencode/core/plugin"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { Tool } from "@opencode/core/tool"
import { Global } from "@opencode/util/global"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { testEffect } from "./lib/effect"
import { executeTool, toolIdentity } from "./lib/tool"
import { permissionLayer } from "./lib/permission"
import { tmpdirScoped } from "./fixture/tmpdir"
import { tempGlobalLayer } from "./fixture/global"
import { offlineModels } from "./fixture/models"
import { hostEnvironmentLayer } from "./fixture/environment"

// Opt in with an installed browser; never download browsers or connect to a user's profile in a test.
const executable = process.env.BOLT_TEST_BROWSER
const it = testEffect(Layer.empty)
const capture = executable ? it.live : it.live.skip
capture(
  "headless browser renders JavaScript, returns readable PNGs and cleans profiles without a desktop attachment",
  () => {
    let denied = false
    const actions: string[] = []
    const permission = permissionLayer({
      allows: () => Effect.succeed(true),
      assert: (input) =>
        Effect.sync(() => actions.push(input.action)).pipe(
          Effect.andThen(
            denied
              ? Effect.fail(
                  new Permission.BlockedError({ rules: [], permission: input.action, resources: input.resources }),
                )
              : Effect.void,
          ),
        ),
    })
    const environment = Layer.effect(
      Environment.Service,
      Effect.gen(function* () {
        const original = yield* Environment.Service
        return Environment.Service.of({
          ...original,
          spawner: ChildProcessSpawner.make((command) => {
            // Isolated test browsers cannot use the kernel sandbox in every CI container.
            // Production keeps Chromium's sandbox enabled for non-root users.
            return original.spawner.spawn(
              command._tag === "StandardCommand"
                ? ChildProcess.make(
                    command.command,
                    [...command.args, "--no-sandbox", "--disable-dev-shm-usage"],
                    command.options,
                  )
                : command,
            )
          }),
        })
      }),
    ).pipe(Layer.provide(hostEnvironmentLayer))
    return Effect.gen(function* () {
      const temp = yield* tmpdirScoped()
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const original = process.env.PATH
          process.env.PATH = `${path.dirname(executable!)}${path.delimiter}${original ?? ""}`
          return original
        }),
        (original) =>
          Effect.sync(() => {
            if (original === undefined) delete process.env.PATH
            else process.env.PATH = original
          }),
      )
      const server = yield* Effect.acquireRelease(
        Effect.promise(async () => {
          const value = http.createServer((_request, response) => {
            response.setHeader("content-type", "text/html")
            response.end(
              '<!doctype html><html><body><h1>Bolt fixture</h1><p id="state">waiting</p><script>setTimeout(() => document.querySelector("#state").textContent = "READY", 50)</script></body></html>',
            )
          })
          await new Promise<void>((resolve) => value.listen(0, "127.0.0.1", resolve))
          return value
        }),
        (server) =>
          Effect.promise(
            () =>
              new Promise<void>((resolve) => {
                server.closeAllConnections()
                server.close(() => resolve())
              }),
          ),
      )
      const address = server.address()
      if (!address || typeof address === "string") return yield* Effect.die("Missing fixture port")
      const url = `http://127.0.0.1:${address.port}/`
      const locations = yield* LocationServiceMap.Service
      yield* Effect.gen(function* () {
        yield* (yield* Plugin.Service).awaitActivation
        const tools = yield* Tool.Service
        const sessions = yield* Session.Service
        const global = yield* Global.Service
        const session = yield* sessions.create({
          location: { directory: AbsolutePath.make(temp.path) },
          agent: toolIdentity.agent,
        })
        const run = (input: Record<string, unknown>) =>
          executeTool(tools, {
            sessionID: session.id,
            ...toolIdentity,
            call: { type: "tool-call", id: "headless-capture", name: "browser", input },
            progress: () => Effect.void,
          })
        const text = yield* run({ url, action: "text" })
        expect(text).toMatchObject({ status: "completed" })
        expect(text.output.output).toContain("Bolt fixture")
        expect(text.output.output).toContain("READY")
        expect(text.output.output).not.toContain("setTimeout")
        const shot = yield* run({ url, width: 640, height: 480 })
        expect(shot).toMatchObject({ status: "completed", output: { action: "screenshot", exit: 0 } })
        const png = yield* Effect.promise(() => fs.readFile(shot.output.path))
        expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
        expect(png.readUInt32BE(16)).toBe(640)
        expect(png.readUInt32BE(20)).toBe(480)
        expect(
          (yield* Effect.promise(() => fs.readdir(global.tmp))).filter((name) => name.startsWith("bolt-browser-")),
        ).toEqual([])
        expect(yield* Effect.promise(() => fs.readdir(path.join(temp.path, ".bolt/tmp")))).toHaveLength(1)
        for (const input of [
          { url: "file:///etc/passwd" },
          { url: "http://169.254.169.254/" },
          { url, width: 0 },
          { url, height: 5000 },
        ])
          expect((yield* run(input)).status).toBe("error")
        denied = true
        expect((yield* run({ url })).status).toBe("error")
        expect(actions).toContain("browser_headless")
        expect(yield* Effect.promise(() => fs.readdir(path.join(temp.path, ".bolt/tmp")))).toHaveLength(1)
      }).pipe(
        Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(temp.path) }))),
        Effect.scoped,
      )
    }).pipe(
      Effect.provide(
        AppNodeBuilder.build(
          LayerNode.group([Database.node, Bus.node, Session.node, Global.node, LocationServiceMap.node]),
          [
            Permission.node.replace(permission),
            Environment.node.replace(environment),
            Global.node.replace(tempGlobalLayer),
            offlineModels,
          ],
        ),
      ),
    )
  },
  40_000,
)
