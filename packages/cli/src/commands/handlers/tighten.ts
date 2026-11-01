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
const EXCERPT_LIMIT = 30_000
const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"]

export type Finding = {
  line: number
  kind: string
  text: string
}

// One entry per loose-type shape worth tightening. Suppression comments are
// scanned everywhere; the code patterns skip comment lines.
const patterns: { pattern: RegExp; kind: string }[] = [
  { pattern: /\bas any\b/, kind: "as any" },
  { pattern: /\bas unknown\b/, kind: "as unknown" },
  { pattern: /:\s*any\b/, kind: ": any" },
  { pattern: /\bany\[\]/, kind: "any[]" },
  { pattern: /<any[,>]/, kind: "<any>" },
  { pattern: /:\s*Function\b/, kind: ": Function" },
  { pattern: /:\s*object\b/, kind: ": object" },
  { pattern: /@ts-(?:ignore|expect-error|nocheck)/, kind: "suppression" },
]

/** Find loose-type sites in a TypeScript source file. */
export function loose(source: string) {
  return source.split("\n").flatMap((text, index) => {
    const trimmed = text.trim()
    const comment = trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")
    return patterns.flatMap((entry) => {
      if (comment && entry.kind !== "suppression") return []
      if (!entry.pattern.test(text)) return []
      return [{ line: index + 1, kind: entry.kind, text: trimmed.slice(0, 160) } satisfies Finding]
    })
  })
}

const INSTRUCTIONS = [
  "Propose stricter types for the loose-type sites listed below. Inspect the files with the read, grep, and glob tools to understand what each value actually is at runtime.",
  "For each site, propose the tightest type that is honest: a concrete interface, a union, a generic, or an Effect Schema where the codebase already uses one. If a site genuinely cannot be tightened, say why in one line.",
  "Do NOT edit any files. Reply with one section per file containing the proposed replacements as fenced diff blocks.",
].join("\n")

export default Runtime.handler(Commands.commands.tighten, (args) =>
  Effect.gen(function* () {
    const model = Option.getOrUndefined(args.model)
    if (model && !validModel(model))
      return yield* Effect.fail(new Error("Provide --model in the format provider/model."))
    const { cwd, files } = yield* changedFiles(args.files, args.branch)
    const targets = files.filter((file: string) => EXTENSIONS.includes(path.extname(file)))
    if (targets.length === 0) {
      println("No TypeScript files to scan.")
      return
    }

    const findings: { file: string; finding: Finding }[] = []
    for (const file of targets) {
      const target = path.resolve(cwd, file)
      const exists = yield* Effect.promise(() => Bun.file(target).exists())
      if (!exists) continue
      const source = yield* Effect.promise(() => Bun.file(target).text())
      for (const finding of loose(source)) {
        findings.push({ file, finding })
      }
    }

    if (findings.length === 0) {
      println(`Scanned ${targets.length} file${targets.length === 1 ? "" : "s"}: no loose types found.`)
      return
    }

    const capped = findings.slice(0, FINDING_LIMIT)
    println(`Found ${findings.length} loose-type site${findings.length === 1 ? "" : "s"}:`)
    for (const entry of capped) {
      println(`  ${entry.file}:${entry.finding.line} [${entry.finding.kind}] ${entry.finding.text}`)
    }
    if (findings.length > capped.length) println(`  ...and ${findings.length - capped.length} more`)
    process.exitCode = 1

    if (!args.suggest) {
      println()
      println("Propose stricter types with: bolt tighten --suggest")
      return
    }

    println()
    println("Asking the agent for stricter types...")
    const listing = capped
      .map((entry) => `- ${entry.file}:${entry.finding.line} [${entry.finding.kind}] ${entry.finding.text}`)
      .join("\n")
      .slice(0, EXCERPT_LIMIT)
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    const text = yield* Effect.tryPromise({
      try: () =>
        answer({ client, agent: "ask", model, title: "bolt tighten", text: `${INSTRUCTIONS}\n\nSites:\n${listing}` }),
      catch: (cause) => cause,
    })
    if (!text.trim()) return yield* Effect.fail(new Error("The model returned an empty suggestion."))
    println()
    println(text)
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))),
)
