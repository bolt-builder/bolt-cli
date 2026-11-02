import fs from "node:fs"
import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { execute } from "../../services/answer"
import { Git } from "../../services/git"
import { runTestCommand } from "../../services/test-command"
import { parseSessionTargetModel } from "../../session-target"
import { errorMessage } from "../../util/error"

const SKIPPED = new Set([".git", "node_modules", "dist", "build", ".turbo", ".cache"])
export function relevant(file: string) {
  return !file
    .replaceAll("\\", "/")
    .split("/")
    .some((segment) => SKIPPED.has(segment))
}
const INSTRUCTIONS = [
  "The following command failed. Investigate the failure, then fix the underlying code or test using your tools.",
  "Do not skip, delete, or weaken tests to make them pass unless the test itself is clearly wrong.",
  "Keep the change minimal and consistent with the surrounding code.",
].join("\n")

export default Runtime.handler(Commands.commands.watch, (input) =>
  Effect.gen(function* () {
    if (input.attempts < 0) return yield* Effect.fail(new Error("--attempts must be non-negative"))
    const model = Option.getOrUndefined(input.model)
    const selection = model === undefined ? undefined : parseSessionTargetModel(model)
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"])
    if (root.exitCode !== 0)
      return yield* Effect.fail(
        new Error("Could not find git repository. Please run this command from a git repository."),
      )
    const cwd = root.stdout.toString().trim()
    const client = input.fix
      ? yield* Effect.gen(function* () {
          const server = yield* ServerConnection.resolve()
          return OpenCode.make({
            baseUrl: server.endpoint.url,
            headers: Service.headers(server.endpoint),
            fetch: noTimeoutFetch,
          })
        })
      : undefined
    let dirty = false
    let failure: Error | undefined
    let notify: (() => void) | undefined
    yield* Effect.acquireRelease(
      Effect.try({
        try: () => {
          const watcher = fs.watch(cwd, { recursive: true }, (_, name) => {
            if (name && !relevant(name)) return
            dirty = true
            notify?.()
          })
          watcher.on("error", (error) => {
            failure = error
            notify?.()
          })
          return watcher
        },
        catch: (cause) => cause,
      }),
      (watcher) =>
        Effect.sync(() => {
          watcher.close()
          notify = undefined
        }),
    )
    process.stdout.write(`Watching ${cwd}\nRunning "${input.command}" on every change. Press ctrl+c to stop.\n`)
    let sessionID: string | undefined
    let failures = 0
    while (true) {
      dirty = false
      notify = undefined
      const run = yield* runTestCommand(input.command, cwd)
      const output = [run.stdout.trim(), run.stderr.trim()].filter(Boolean).join("\n")
      if (output) process.stdout.write(output + "\n")
      if (run.exitCode === 0) {
        failures = 0
        process.stdout.write("Passed. Waiting for changes...\n")
      }
      if (run.exitCode !== 0) {
        failures++
        process.stdout.write(`Failed with exit code ${run.exitCode}.\n`)
        if (client && failures <= input.attempts) {
          process.stdout.write(`Asking the agent to fix it (attempt ${failures}/${input.attempts})...\n`)
          yield* Effect.gen(function* () {
            if (!sessionID)
              sessionID = (yield* Effect.tryPromise({
                try: () =>
                  client.session.create({
                    agent: "build",
                    title: `bolt watch: ${input.command}`,
                    model: selection,
                    location: { directory: cwd },
                    permissions: [{ action: "question", resource: "*", effect: "deny" }],
                  }),
                catch: (cause) => cause,
              })).id
            const result = yield* Effect.tryPromise({
              try: () =>
                execute({
                  client,
                  sessionID,
                  agent: "build",
                  title: `bolt watch: ${input.command}`,
                  directory: cwd,
                  model,
                  retain: true,
                  text: `${INSTRUCTIONS}\n\nCommand: ${input.command}\n\nOutput:\n${output.slice(-20000)}`,
                }),
              catch: (cause) => cause,
            })
            process.stdout.write(result.text + "\n")
          }).pipe(
            Effect.catch((error) =>
              Effect.sync(() => {
                process.stderr.write(`fix attempt failed: ${errorMessage(error)}\n`)
              }),
            ),
          )
          dirty = true
        }
        if (client && failures > input.attempts)
          process.stdout.write(`Giving up after ${input.attempts} fix attempts. Waiting for a manual change...\n`)
        if (!client) process.stdout.write("Waiting for changes...\n")
      }
      if (failure) return yield* Effect.fail(failure)
      yield* Effect.callback<void>((resume) => {
        if (dirty || failure) {
          resume(Effect.void)
          return
        }
        notify = () => resume(Effect.void)
        return Effect.sync(() => {
          notify = undefined
        })
      })
      if (failure) return yield* Effect.fail(failure)
      yield* Effect.sleep("200 millis")
    }
  }).pipe(
    Effect.provide(LayerNode.compile(AppProcess.node)),
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
