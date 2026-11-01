import fs from "node:fs"
import path from "node:path"
import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Git } from "../../services/git"
import { ServerConnection } from "../../services/server-connection"
import { answer } from "../../services/answer"
import { verdict } from "../../services/review"
import { validModel } from "./ask"
import { errorMessage } from "../../util/error"
const println = (text = "") => process.stdout.write(text + "\n")
const fail = (text: string) => Effect.fail(new Error(text))
const FILE = path.join(".bolt", "invariants.md")
const FILE_LIMIT = 24_000
const TOTAL_LIMIT = 60_000
const DIFF_LIMIT = 60_000

/** Extract bulleted or numbered invariant lines from an agent response. */
export function extract(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .flatMap((line) => {
      const match = line.match(/^(?:[-*]|\d+[.)])\s+(.+)$/)
      if (!match) return []
      return [match[1].trim()]
    })
    .filter((line) => line.length > 0)
}

/** Render the invariants document persisted between the state and verify phases. */
export function document(files: readonly string[], invariants: readonly string[]) {
  return ["# Invariants", "", `Files: ${files.join(", ")}`, "", ...invariants.map((line) => `- ${line}`), ""].join("\n")
}

/** Parse a persisted invariants document back into its files and invariants. */
export function parse(content: string) {
  const lines = content.split("\n")
  const header = lines.find((line) => line.startsWith("Files: "))
  const files = header
    ? header
        .slice("Files: ".length)
        .split(", ")
        .filter((name) => name.length > 0)
    : []
  return { files, invariants: extract(lines.filter((line) => line.startsWith("- ")).join("\n")) }
}

const STATE = [
  "You are about to refactor the files below. State the behavioral invariants that must still hold after the refactor: observable behaviors, input and output contracts, side effects, error handling, and edge cases callers rely on.",
  "Inspect surrounding code with the read, grep, and glob tools when the excerpts are not enough.",
  "Reply with one invariant per line as a markdown bullet starting with '- '. State only concrete, verifiable invariants. At most 15.",
].join("\n")

const VERIFY = [
  "A refactor was just performed. The invariants below were stated before it started.",
  "Verify each invariant still holds by inspecting the current code with the read, grep, and glob tools. The diff of the refactor is included for context.",
  "For each invariant, reply with a line starting with 'HOLDS' or 'VIOLATED' followed by the invariant and a one-line justification.",
  'End your final message with exactly one line: "Verdict: PASS" if every invariant holds, otherwise "Verdict: FAIL".',
].join("\n")

export default Runtime.handler(Commands.commands.invariants, (args) =>
  Effect.gen(function* () {
    const model = Option.getOrUndefined(args.model)
    if (model && !validModel(model)) return yield* fail("Provide --model in the format provider/model.")
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"])
    if (root.exitCode !== 0)
      return yield* fail("Could not find git repository. Please run this command from a git repository.")
    const cwd = root.stdout.toString().trim()
    const store = path.join(cwd, FILE)
    const ask = (title: string, text: string) =>
      Effect.gen(function* () {
        const server = yield* ServerConnection.resolve()
        const client = OpenCode.make({
          baseUrl: server.endpoint.url,
          headers: Service.headers(server.endpoint),
          fetch: noTimeoutFetch,
        })
        return yield* Effect.tryPromise({
          try: () => answer({ client, agent: "ask", model, title, text }),
          catch: (cause) => cause,
        })
      })
    if (args.action === "state") {
      if (args.files.length === 0) return yield* fail("Pass the files you are about to refactor.")
      const excerpts: string[] = []
      for (const file of args.files) {
        const target = path.resolve(cwd, file)
        const exists = yield* Effect.promise(() => Bun.file(target).exists())
        if (!exists) return yield* fail(`No such file: ${file}`)
        const content = yield* Effect.promise(() => Bun.file(target).text())
        excerpts.push(`### ${file}\n\n${content.slice(0, FILE_LIMIT)}`)
      }
      const body = excerpts.join("\n\n").slice(0, TOTAL_LIMIT)

      println("Stating invariants...")
      const text = yield* ask("bolt invariants: state", `${STATE}\n\n${body}`)
      const invariants = extract(text)
      if (invariants.length === 0) return yield* fail("The model did not state any invariants.")

      fs.mkdirSync(path.dirname(store), { recursive: true })
      fs.writeFileSync(store, document(args.files, invariants))
      println()
      for (const line of invariants) println(`- ${line}`)
      println()
      println(`Saved ${invariants.length} invariants to ${FILE}. After refactoring, run: bolt invariants verify`)
      return
    }

    if (!fs.existsSync(store)) {
      return yield* fail(`No stated invariants found at ${FILE}. Run "bolt invariants state <files..>" first.`)
    }
    const saved = parse(fs.readFileSync(store, "utf8"))
    if (saved.invariants.length === 0) return yield* fail(`Could not parse any invariants from ${FILE}.`)

    const diff = yield* git.run(["diff", Option.getOrElse(args.range, () => "HEAD")], cwd)
    if (diff.exitCode !== 0) return yield* fail(diff.stderr.toString().trim() || "git diff failed")
    const patch = diff.stdout.toString().trim().slice(0, DIFF_LIMIT)

    println(`Verifying ${saved.invariants.length} invariants...`)
    const text = yield* ask(
      "bolt invariants: verify",
      [
        VERIFY,
        "",
        `Files under refactor: ${saved.files.join(", ")}`,
        "",
        "Invariants:",
        ...saved.invariants.map((line) => `- ${line}`),
        "",
        "Diff:",
        patch || "(no diff; the refactor is already committed, inspect the files directly)",
      ].join("\n"),
    )
    if (!text) return yield* fail("The model returned an empty verification.")

    println()
    println(text)
    println()

    const outcome = verdict(text)
    if (outcome === "pass") return
    if (outcome === "fail") {
      process.exitCode = 1
      return
    }
    println("Could not determine a verdict from the verification.")
    process.exitCode = 2
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
