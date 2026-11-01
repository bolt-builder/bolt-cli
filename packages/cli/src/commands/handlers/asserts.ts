import path from "node:path"
import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { changedFiles } from "../../services/changed-files"
import { ServerConnection } from "../../services/server-connection"
import { answer } from "../../services/answer"
import { validModel } from "./ask"
const println = (text = "") => process.stdout.write(text + "\n")
const FINDING_LIMIT = 100
const LISTING_LIMIT = 30_000

export type Mined = {
  name: string
  line: number
  expects: number
  weak: number
}

const START = /(?:^|[^\w.])(?:test|it)(?:\.\w+)?\(\s*["'`](.*?)["'`]/
const WEAK = [/\.toBeTruthy\(/g, /\.toBeFalsy\(/g, /\.toBeDefined\(/g, /\.not\.toThrow\(/g, /\.toMatchSnapshot\(/g]

/** Parse a test file into its test blocks with assertion counts. */
export function mine(source: string) {
  const blocks: Mined[] = []
  let current: Mined | undefined
  let parens = 0
  let quote = ""
  let blockComment = false
  let escaped = false
  source.split("\n").forEach((text, index) => {
    let start = 0
    if (!current) {
      const match = text.match(START)
      if (!match) return
      current = { name: match[1], line: index + 1, expects: 0, weak: 0 }
      blocks.push(current)
      parens = 1
      start = (match.index ?? 0) + match[0].length
    }
    let body = ""
    for (let position = start; position < text.length; position++) {
      const char = text[position]
      const next = text[position + 1]
      if (blockComment) {
        if (char === "*" && next === "/") {
          blockComment = false
          position++
        }
        continue
      }
      if (quote) {
        if (escaped) {
          escaped = false
          continue
        }
        if (char === "\\") {
          escaped = true
          continue
        }
        if (char === quote) quote = ""
        continue
      }
      if (char === "/" && next === "/") break
      if (char === "/" && next === "*") {
        blockComment = true
        position++
        continue
      }
      if (char === "'" || char === '\"' || char === "`") {
        quote = char
        continue
      }
      if (char === "(") parens++
      if (char === ")") {
        parens--
        if (parens === 0) {
          current = undefined
          break
        }
      }
      body += char
    }
    const block = blocks.at(-1)!
    block.expects += (body.match(/\bexpect\s*\(/g) ?? []).length + (body.match(/\bassert[.(]/g) ?? []).length
    block.weak += WEAK.reduce((sum, weak) => sum + (body.match(weak) ?? []).length, 0)
  })
  return blocks
}

export type Finding = {
  kind: "none" | "weak"
  block: Mined
}

/** Flag test blocks with no assertions or only weak ones. */
export function findings(blocks: Mined[]) {
  return blocks.flatMap((block): Finding[] => {
    if (block.expects === 0) return [{ kind: "none", block }]
    if (block.weak >= block.expects) return [{ kind: "weak", block }]
    return []
  })
}

const INSTRUCTIONS = [
  "The test blocks listed below either have no assertions or rely only on weak ones (toBeTruthy, toBeDefined, snapshot-only, and similar).",
  "Read each test file and the code under test with the read, grep, and glob tools, then suggest the specific missing assertions: what exact values or shapes each test should assert to actually pin the behavior down.",
  "Do NOT edit any files. Reply with one section per test, each containing the suggested expect(...) lines in a fenced code block.",
].join("\n")

export default Runtime.handler(Commands.commands.asserts, (args) =>
  Effect.gen(function* () {
    const model = Option.getOrUndefined(args.model)
    if (model && !validModel(model))
      return yield* Effect.fail(new Error("Provide --model in the format provider/model."))
    const { cwd, files } = yield* changedFiles(args.files, args.branch)
    const targets = files.filter((file: string) => /(?:\.test\.|\.spec\.|_test\.|(?:^|[\\/])test_)/.test(file))
    if (targets.length === 0) {
      println("No test files to scan.")
      return
    }

    const flagged: { file: string; finding: Finding }[] = []
    let total = 0
    for (const file of targets) {
      const target = path.resolve(cwd, file)
      const exists = yield* Effect.promise(() => Bun.file(target).exists())
      if (!exists) continue
      const source = yield* Effect.promise(() => Bun.file(target).text())
      const blocks = mine(source)
      total += blocks.length
      for (const finding of findings(blocks)) {
        flagged.push({ file, finding })
      }
    }

    if (flagged.length === 0) {
      println(`Scanned ${total} test${total === 1 ? "" : "s"}: every test asserts something concrete.`)
      return
    }

    const capped = flagged.slice(0, FINDING_LIMIT)
    println(`Found ${flagged.length} test${flagged.length === 1 ? "" : "s"} with missing or weak assertions:`)
    for (const entry of capped) {
      const label = entry.finding.kind === "none" ? "no assertions" : "only weak assertions"
      println(`  ${entry.file}:${entry.finding.block.line} [${label}] ${entry.finding.block.name}`)
    }
    if (flagged.length > capped.length) println(`  ...and ${flagged.length - capped.length} more`)
    process.exitCode = 1

    if (!args.suggest) {
      println()
      println("Suggest the missing assertions with: bolt asserts --suggest")
      return
    }

    println()
    println("Asking the agent for the missing assertions...")
    const listing = capped
      .map((entry) => {
        const label = entry.finding.kind === "none" ? "no assertions" : "only weak assertions"
        return `- ${entry.file}:${entry.finding.block.line} [${label}] ${entry.finding.block.name}`
      })
      .join("\n")
      .slice(0, LISTING_LIMIT)
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    const text = yield* Effect.tryPromise({
      try: () =>
        answer({ client, agent: "ask", model, title: "bolt asserts", text: `${INSTRUCTIONS}\n\nTests:\n${listing}` }),
      catch: (cause) => cause,
    })
    if (!text.trim()) return yield* Effect.fail(new Error("The model returned an empty suggestion."))
    println()
    println(text)
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))),
)
