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
import { errorMessage } from "../../util/error"
import { parseSessionTargetModel } from "../../session-target"
import path from "node:path"
import { ChildProcess } from "effect/process"

const OUTPUT_LIMIT = 10_000

/** Parse the last `Name: value` marker line from an agent response. */
export function marker(text: string, name: string) {
  const matches = [...text.matchAll(new RegExp(`^${name}:\\s*(.+)$`, "gim"))]
  const last = matches.at(-1)
  if (!last) return undefined
  const value = last[1].trim().replace(/^`+|`+$/g, "")
  if (!value) return undefined
  return value
}

const INSTRUCTIONS = [
  "Write a minimal automated test that reproduces the bug described below. The test must FAIL on the current code because the bug is still present, and it must pass once the bug is fixed.",
  "Inspect the codebase with the read, grep, and glob tools to find the buggy code and the existing test conventions. Place the test where this project keeps its tests, following its naming style, and create it with the write tool. Do NOT fix the bug itself and do NOT touch any other file.",
  "End your final message with exactly two lines:",
  "Test: <path of the test file you created, relative to the repository root>",
  "Command: <shell command that runs exactly that test file>",
].join("\n")

export default Runtime.handler(Commands.commands.guard, (input) =>
  Effect.gen(function* () {
    const cwd = process.cwd()
    const model = Option.getOrUndefined(input.model)
    if (model !== undefined) parseSessionTargetModel(model)
    const prompt = `${INSTRUCTIONS}\n\nBug:\n${input.bug}`
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    const result = yield* Effect.tryPromise({
      try: () => execute({ client, agent: "build", model, title: "bolt guard", text: prompt, retain: true }),
      catch: (cause) => cause,
    })
    const file = marker(result.text, "Test")
    const command = marker(result.text, "Command")
    if (!file || !command)
      return yield* Effect.fail(new Error("The model did not report the Test: and Command: markers.\n" + result.text))
    if (!(yield* Effect.promise(() => Bun.file(path.resolve(cwd, file)).exists())))
      return yield* Effect.fail(new Error(`The model reported ${file}, but that file does not exist.`))
    process.stdout.write(`Test written: ${file}\nRunning "${command}" to confirm it fails before the fix...\n`)
    const shell = process.platform === "win32" ? ["cmd", "/d", "/s", "/c", command] : ["sh", "-c", command]
    const app = yield* AppProcess.Service
    const run = yield* app.run(ChildProcess.make(shell[0], shell.slice(1), { cwd }), {
      maxOutputBytes: OUTPUT_LIMIT,
      maxErrorBytes: OUTPUT_LIMIT,
    })
    const output = [run.stdout.toString().trim(), run.stderr.toString().trim()].filter(Boolean).join("\n")
    if (run.exitCode === 0)
      return yield* Effect.fail(
        new Error(
          `The new test PASSES, so it does not reproduce the bug. Refine the description and rerun.\nKept for inspection: ${file}`,
        ),
      )
    process.stdout.write(
      `${output}\nThe test fails as expected (exit ${run.exitCode}). The regression is pinned down.\nFix the bug, then prove it with: ${command}\n`,
    )
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
