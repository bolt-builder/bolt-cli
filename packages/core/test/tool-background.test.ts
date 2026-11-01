import { expect } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Effect, Layer } from "effect"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Database } from "@opencode/core/database/database"
import { Bus } from "@opencode/core/bus"
import { Location } from "@opencode/core/location"
import { LocationServiceMap } from "@opencode/core/location-service-map"
import { Permission } from "@opencode/core/permission"
import { Plugin } from "@opencode/core/plugin"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { SessionExecution } from "@opencode/core/session/execution"
import { Tool } from "@opencode/core/tool"
import { Global } from "@opencode/util/global"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { makeGlobalNode } from "@opencode/util/effect/app-node"
import { testEffect } from "./lib/effect"
import { executeTool, toolIdentity } from "./lib/tool"
import { permissionLayer } from "./lib/permission"
import { tmpdirScoped } from "./fixture/tmpdir"
import { tempGlobalLayer } from "./fixture/global"
import { offlineModels } from "./fixture/models"

testEffect(Layer.empty).live(
  "V1 process tools share approved V2 jobs, live output, repeated stdin and cancellation",
  () => {
    let denied = false
    const actions: string[] = []
    const permission = permissionLayer({
      assert: (input) =>
        Effect.sync(() => actions.push(input.action)).pipe(
          Effect.andThen(
            denied && input.action === "shell"
              ? Effect.fail(
                  new Permission.BlockedError({ rules: [], permission: input.action, resources: input.resources }),
                )
              : Effect.void,
          ),
        ),
      allows: () => Effect.succeed(true),
    })
    return Effect.gen(function* () {
      const temp = yield* tmpdirScoped()
      const directory = path.join(temp.path, "project with spaces")
      yield* Effect.promise(async () => {
        await fs.mkdir(directory)
        await Bun.write(
          path.join(directory, "interactive.mjs"),
          `
        process.stdin.setEncoding('utf8'); let pending = '';
        process.stdout.write('ready\\n');
        process.stdin.on('data', data => { pending += data; let n;
          while ((n = pending.indexOf('\\n')) !== -1) {
            const line = pending.slice(0,n); pending = pending.slice(n+1);
            console.log('echo:' + line); if (line === 'quit') process.exit(0);
          }
        });
      `,
        )
        await Bun.write(
          path.join(directory, "tail.mjs"),
          "console.log('x'.repeat(80000) + 'TAIL_READY'); setInterval(() => {}, 1000)",
        )
      })
      const locations = yield* LocationServiceMap.Service
      yield* Effect.gen(function* () {
        yield* (yield* Plugin.Service).awaitActivation
        const tools = yield* Tool.Service
        const sessions = yield* Session.Service
        const session = yield* sessions.create({
          location: { directory: AbsolutePath.make(directory) },
          agent: toolIdentity.agent,
        })
        const other = yield* sessions.create({
          location: { directory: AbsolutePath.make(directory) },
          agent: toolIdentity.agent,
        })
        const run = (name: string, input: Record<string, unknown>, sessionID = session.id) =>
          executeTool(tools, {
            sessionID,
            ...toolIdentity,
            call: { type: "tool-call", id: `background-${name}`, name, input },
            progress: () => Effect.void,
          })
        const until = (id: string, predicate: (output: { status: string; output: string }) => boolean) =>
          Effect.gen(function* () {
            for (let i = 0; i < 200; i++) {
              const result = yield* run("process_output", { id })
              if (result.status === "completed" && predicate(result.output)) return result
              yield* Effect.promise(() => Bun.sleep(10))
            }
            return yield* Effect.fail(new Error("Process fixture did not reach expected state"))
          })
        expect((yield* run("list_processes", {})).output.count).toBe(0)
        denied = true
        expect((yield* run("bash_background", { command: "node interactive.mjs" })).status).toBe("error")
        expect((yield* run("list_processes", {})).output.count).toBe(0)
        denied = false
        const started = yield* run("bash_background", { command: "node interactive.mjs", title: "input fixture" })
        expect(started).toMatchObject({ status: "completed", output: { status: "running" } })
        const id = started.output.id
        yield* until(id, (output) => output.output.includes("ready"))
        expect((yield* run("background_stdin", { id, data: "first", enter: false })).output.bytes).toBe(5)
        expect((yield* run("background_stdin", { id, data: " line" })).output.bytes).toBe(6)
        yield* until(id, (output) => output.output.includes("echo:first line"))
        expect((yield* run("background_stdin", { id, data: "second" })).status).toBe("completed")
        yield* until(id, (output) => output.output.includes("echo:second"))
        expect((yield* run("list_processes", {}, other.id)).output.count).toBe(0)
        for (const name of ["process_output", "background_stdin", "kill_process"])
          expect((yield* run(name, { id, data: "wrong session" }, other.id)).status).toBe("error")
        denied = true
        for (const name of ["background_stdin", "kill_process"])
          expect((yield* run(name, { id, data: "quit" })).status).toBe("error")
        expect((yield* run("process_output", { id })).output.status).toBe("running")
        denied = false
        expect((yield* run("background_stdin", { id, data: "é".repeat(40000) })).status).toBe("error")
        yield* run("background_stdin", { id, data: "quit" })
        const done = yield* run("process_output", { id, wait: 10_000 })
        expect(done).toMatchObject({ status: "completed", output: { status: "completed" } })
        expect(done.output.output).toContain("echo:quit")
        expect((yield* run("background_stdin", { id, data: "closed" })).status).toBe("error")
        expect((yield* run("kill_process", { id })).output.status).toBe("completed")
        const second = yield* run("bash_background", { command: "node tail.mjs" })
        const tail = yield* until(second.output.id, (output) => output.output.includes("TAIL_READY"))
        expect(tail.output.truncated).toBe(true)
        expect(tail.output.output.length).toBeLessThan(66_000)
        expect((yield* run("kill_process", { id: second.output.id })).output.status).toBe("cancelled")
        expect((yield* run("background_stdin", { id: second.output.id, data: "closed" })).status).toBe("error")
        const noInput = yield* run("shell", { command: "node tail.mjs", background: true })
        expect((yield* run("background_stdin", { id: noInput.output.shellID, data: "no pipe" })).status).toBe("error")
        yield* run("kill_process", { id: noInput.output.shellID })
        expect((yield* run("list_processes", {})).output.count).toBe(3)
        expect((yield* run("process_output", { id: "unknown" })).status).toBe("error")
        expect((yield* run("process_output", { id, wait: -1 })).status).toBe("error")
        expect(actions.filter((action) => action === "shell").length).toBeGreaterThanOrEqual(7)
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
          SessionExecution.node.replace(
            makeGlobalNode({
              service: SessionExecution.Service,
              deps: [],
              layer: Layer.succeed(
                SessionExecution.Service,
                SessionExecution.Service.of({
                  active: Effect.succeed(new Set()),
                  isActive: () => Effect.succeed(false),
                  resume: () => Effect.void,
                  wake: () => Effect.void,
                  interrupt: () => Effect.succeed(false),
                  awaitIdle: () => Effect.void,
                }),
              ),
            }),
          ),
        ]),
      ),
    )
  },
)
