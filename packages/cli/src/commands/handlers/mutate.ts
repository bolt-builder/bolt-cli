import path from "node:path"
import fs from "node:fs/promises"
import { Effect, Option, Schema } from "effect"
import { EffectFlock } from "@opencode/util/effect-flock"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Git } from "../../services/git"
import { runTestCommand } from "../../services/test-command"
import { errorMessage } from "../../util/error"

export type Mutant = {
  line: number
  description: string
  source: string
}

type Operator = {
  pattern: RegExp
  replacement: string
}

// One entry per mutation operator. Patterns are line-scoped and deliberately
// conservative: bare `<` and `>` are skipped (generics, JSX), compound
// assignments like `&&=` are excluded, and arithmetic only matches spaced
// binary operators so `++`, `--`, and unary signs are left alone.
const operators: Operator[] = [
  // `[=]` avoids a regex literal starting with `/=`, which reads like `/=`.
  { pattern: /[=]==/g, replacement: "!==" },
  { pattern: /!==/g, replacement: "===" },
  { pattern: /(?<![&=!])&&(?![&=])/g, replacement: "||" },
  { pattern: /(?<![|=])\|\|(?![|=])/g, replacement: "&&" },
  { pattern: /(?<!<)<=/g, replacement: "<" },
  { pattern: /(?<!>)>=(?!=)/g, replacement: ">" },
  { pattern: / \+ /g, replacement: " - " },
  { pattern: / - /g, replacement: " + " },
  { pattern: /\btrue\b/g, replacement: "false" },
  { pattern: /\bfalse\b/g, replacement: "true" },
]

/** Generate single-site mutants of a source file, one per mutable occurrence. */
export function mutate(source: string) {
  const lines = source.split("\n")
  return lines.flatMap((text, index) => {
    const trimmed = text.trimStart()
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return []
    return operators.flatMap((operator) =>
      [...text.matchAll(operator.pattern)].map(
        (match): Mutant => ({
          line: index + 1,
          description: `${match[0].trim()} -> ${operator.replacement.trim()}`,
          source: [
            ...lines.slice(0, index),
            text.slice(0, match.index) + operator.replacement + text.slice(match.index + match[0].length),
            ...lines.slice(index + 1),
          ].join("\n"),
        }),
      ),
    )
  })
}

export async function detect(directory: string) {
  const exists = (name: string) => Bun.file(path.join(directory, name)).exists()
  if (await exists("package.json")) {
    const manifest = Schema.decodeUnknownOption(
      Schema.Struct({ scripts: Schema.optional(Schema.Struct({ test: Schema.optional(Schema.String) })) }),
    )(
      await Bun.file(path.join(directory, "package.json"))
        .json()
        .catch(() => undefined),
    )
    if (Option.isSome(manifest) && manifest.value.scripts?.test) {
      if ((await exists("bun.lock")) || (await exists("bun.lockb"))) return "bun run test"
      if (await exists("pnpm-lock.yaml")) return "pnpm test"
      if (await exists("yarn.lock")) return "yarn test"
      return "npm test"
    }
  }
  if (await exists("Cargo.toml")) return "cargo test"
  if (await exists("go.mod")) return "go test ./..."
  if ((await exists("pytest.ini")) || (await exists("pyproject.toml"))) return "pytest"
}

export default Runtime.handler(Commands.commands.mutate, (input) =>
  Effect.gen(function* () {
    if (!Number.isInteger(input.limit) || input.limit < 1)
      return yield* Effect.fail(new Error("--limit must be a positive integer"))
    if (!Number.isFinite(input.timeout) || input.timeout <= 0)
      return yield* Effect.fail(new Error("--timeout must be a positive number of milliseconds"))
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"])
    if (root.exitCode !== 0)
      return yield* Effect.fail(
        new Error("Could not find git repository. Please run this command from a git repository."),
      )
    const cwd = root.stdout.toString().trim()
    const target = yield* Effect.tryPromise(() => fs.realpath(path.resolve(cwd, input.file)))
    const lock = yield* EffectFlock.Service
    yield* lock.acquire(`bolt.mutate:${target}`)
    const original = yield* Effect.tryPromise(() => fs.readFile(target))
    const command = Option.getOrUndefined(input.command) ?? (yield* Effect.tryPromise(() => detect(cwd)))
    if (!command?.trim())
      return yield* Effect.fail(new Error("Could not detect a test command for this project. Pass one with --command."))
    const found = mutate(original.toString())
    if (!found.length) {
      process.stdout.write("No mutable sites found in this file.\n")
      return
    }
    const mutants = found.slice(0, input.limit)
    const execute = runTestCommand(command, cwd).pipe(
      Effect.timeoutOrElse({
        duration: input.timeout,
        orElse: () => Effect.succeed({ stdout: "", stderr: "Timed out", exitCode: 124 }),
      }),
    )
    process.stdout.write(`Baseline: running "${command}"...\n`)
    if ((yield* execute).exitCode !== 0)
      return yield* Effect.fail(new Error("The test command fails before any mutation. Fix the suite first."))
    process.stdout.write(`Testing ${mutants.length} of ${found.length} mutants...\n`)
    const survivors: Mutant[] = []
    yield* Effect.gen(function* () {
      for (const [index, mutant] of mutants.entries()) {
        yield* Effect.tryPromise(() => fs.writeFile(target, mutant.source))
        const run = yield* execute
        if (run.exitCode === 0) survivors.push(mutant)
        process.stdout.write(
          `  mutant ${index + 1}/${mutants.length} line ${mutant.line} ${mutant.description}: ${run.exitCode === 0 ? "SURVIVED" : "killed"}\n`,
        )
      }
    }).pipe(Effect.ensuring(Effect.promise(() => fs.writeFile(target, original))))
    const killed = mutants.length - survivors.length
    process.stdout.write(
      `\nMutation score: ${killed}/${mutants.length} killed (${Math.round((killed / mutants.length) * 100)}%).\n`,
    )
    if (!survivors.length) {
      process.stdout.write("Every mutant was caught. The tests guard this file well.\n")
      return
    }
    process.stdout.write("Surviving mutants mean the tests never noticed the change:\n")
    for (const mutant of survivors) process.stdout.write(`  ${input.file}:${mutant.line} ${mutant.description}\n`)
    process.exitCode = 1
  }).pipe(
    Effect.provide(LayerNode.compile(LayerNode.group([AppProcess.node, EffectFlock.node]))),
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
