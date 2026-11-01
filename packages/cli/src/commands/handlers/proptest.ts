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
const FILE_LIMIT = 40_000

/** Parse the last `Name: value` marker line from an agent response. */
export function marker(text: string, name: string) {
  const matches = [...text.matchAll(new RegExp(`^${name}:\\s*(.+)$`, "gim"))]
  const last = matches.at(-1)
  if (!last) return undefined
  const value = last[1].trim().replace(/^`+|`+$/g, "")
  if (!value) return undefined
  return value
}

export type Candidate = {
  name: string
  line: number
  signature: string
}

// Async functions and generators are excluded up front: they are never pure.
// The remaining candidates are only *candidates*; the agent decides purity by
// reading the bodies.
const declarations = [/^export function (\w+)\s*\(/, /^export const (\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>/]

/** Extract exported function candidates that could be pure, with their line numbers. */
export function candidates(source: string) {
  return source.split("\n").flatMap((text, index) => {
    const line = text.trimEnd()
    return declarations.flatMap((declaration) => {
      const match = line.match(declaration)
      if (!match) return []
      return [
        {
          name: match[1],
          line: index + 1,
          signature: line.trim().slice(0, 200),
        } satisfies Candidate,
      ]
    })
  })
}

const INSTRUCTIONS = [
  "Generate property-based tests for the pure exported functions listed below. First read the file and decide which candidates are actually pure (no I/O, no mutation of external state, deterministic output for the same input); skip the impure ones.",
  "For each pure function, test properties rather than single examples: round-trips, idempotence, invariants over outputs, commutativity, or agreement with a simple oracle. Generate many inputs per property with a seeded pseudo-random generator so runs are deterministic.",
  "Do NOT add any dependency. Use the project's existing test framework and conventions; inspect neighboring tests with the read, grep, and glob tools first. Create exactly one new test file with the write tool and do not modify any other file.",
  "End your final message with exactly two lines:",
  "Test: <path of the test file you created, relative to the repository root>",
  "Command: <shell command that runs exactly that test file>",
].join("\n")

export default Runtime.handler(Commands.commands.proptest, (input) =>
  Effect.gen(function* () {
    const cwd = process.cwd()
    const model = Option.getOrUndefined(input.model)
    if (model !== undefined) parseSessionTargetModel(model)
    const source = Bun.file(path.resolve(cwd, input.file))
    if (!(yield* Effect.promise(() => source.exists())))
      return yield* Effect.fail(new Error(`No such file: ${input.file}`))
    if (source.size > 4_000_000) return yield* Effect.fail(new Error("Source file is too large (maximum 4 MB)."))
    const text = yield* Effect.promise(() => source.text())
    const found = candidates(text)
    const name = Option.getOrUndefined(input.name)
    const chosen = name ? found.filter((candidate) => candidate.name === name) : found
    if (!chosen.length)
      return yield* Effect.fail(
        new Error(
          name
            ? `No exported function candidate named "${name}" in ${input.file}.`
            : `No exported function candidates found in ${input.file}.`,
        ),
      )
    process.stdout.write(`Found ${chosen.length} candidate${chosen.length === 1 ? "" : "s"}:\n`)
    for (const candidate of chosen) process.stdout.write(`  ${input.file}:${candidate.line} ${candidate.name}\n`)
    const prompt = [
      INSTRUCTIONS,
      `File: ${input.file}`,
      "Candidates:",
      ...chosen.map((candidate) => `- ${candidate.name} (line ${candidate.line}): ${candidate.signature}`),
      "Source:",
      text.slice(0, FILE_LIMIT),
      source.size > FILE_LIMIT ? "[source excerpt truncated; read the file to inspect remaining functions]" : "",
    ].join("\n\n")
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    const result = yield* Effect.tryPromise({
      try: () => execute({ client, agent: "build", model, title: "bolt proptest", text: prompt, retain: true }),
      catch: (cause) => cause,
    })
    const file = marker(result.text, "Test")
    const command = marker(result.text, "Command")
    if (!file || !command)
      return yield* Effect.fail(new Error("The model did not report the Test: and Command: markers.\n" + result.text))
    if (!(yield* Effect.promise(() => Bun.file(path.resolve(cwd, file)).exists())))
      return yield* Effect.fail(new Error(`The model reported ${file}, but that file does not exist.`))
    process.stdout.write(`Test written: ${file}\nRunning "${command}" to confirm the properties hold...\n`)
    const shell = process.platform === "win32" ? ["cmd", "/d", "/s", "/c", command] : ["sh", "-c", command]
    const app = yield* AppProcess.Service
    const run = yield* app.run(ChildProcess.make(shell[0], shell.slice(1), { cwd }), {
      maxOutputBytes: OUTPUT_LIMIT,
      maxErrorBytes: OUTPUT_LIMIT,
    })
    const output = [run.stdout.toString().trim(), run.stderr.toString().trim()].filter(Boolean).join("\n")
    if (run.exitCode !== 0)
      return yield* Effect.fail(
        new Error(
          `${output}\nThe generated properties FAIL (exit ${run.exitCode}). Either a property found a real bug or the test is wrong; inspect ${file}.`,
        ),
      )
    process.stdout.write(`All properties hold. Keep ${file} to lock the behavior in.\n`)
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
