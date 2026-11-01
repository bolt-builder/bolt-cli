import { Effect, Option } from "effect"
import path from "node:path"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { answer } from "../../services/answer"
import { Git } from "../../services/git"
import { errorMessage } from "../../util/error"
import { validModel } from "./ask"

const LIMIT = 80_000
const PATCHES = 5
const PATCHCAP = 6_000

const INSTRUCTIONS = [
  "You are a git archaeologist. Answer the question below about when and why a behavior changed, using only the commit evidence provided.",
  "Name the specific commits that changed the behavior, when they landed, and what the stated motivation was. Cite commits inline by their short sha, e.g. abc1234. If the evidence is not enough to answer confidently, say exactly what is missing instead of guessing.",
].join("\n")

export type Entry = {
  readonly sha: string
  readonly author: string
  readonly date: string
  readonly subject: string
}

/** Parse `git log --format=%H%x00%an%x00%cd%x00%s%x01` output into commit entries. */
export function entries(text: string) {
  return text
    .split("\x01")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => chunk.split("\x00"))
    .filter((parts) => parts.length === 4 && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(parts[0]))
    .map((parts) => ({ sha: parts[0], author: parts[1], date: parts[2], subject: parts[3] }) satisfies Entry)
}

/** Parse a --lines spec like "120" or "120,160" into a git -L range. */
export function span(spec: string) {
  const match = spec.match(/^(\d+)(?:,(\d+))?$/)
  if (!match) return undefined
  const start = Number(match[1])
  const end = match[2] === undefined ? start : Number(match[2])
  if (start < 1 || end < start) return undefined
  return { start, end }
}

/** Collect which of the evidence shas an answer actually cites. */
export function cited(text: string, shas: string[]) {
  return shas.filter((sha) => text.includes(sha.slice(0, 7)))
}

export default Runtime.handler(Commands.commands.why, (input) =>
  Effect.gen(function* () {
    const requestedFile = Option.getOrUndefined(input.file)
    const lineSpec = Option.getOrUndefined(input.lines)
    const term = Option.getOrUndefined(input.term)
    const model = Option.getOrUndefined(input.model)
    if (!requestedFile && !term)
      return yield* Effect.fail(new Error("Point the dig somewhere: pass --file <path> and/or --term <string>."))
    if (lineSpec && !requestedFile) return yield* Effect.fail(new Error("--lines requires --file."))
    if (model && !validModel(model))
      return yield* Effect.fail(new Error("Provide --model in the format provider/model."))
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const cwd = root.stdout.toString().trim()
    const file = requestedFile ? path.relative(cwd, path.resolve(requestedFile)) : undefined
    const format = "--format=%H%x00%an%x00%cd%x00%s%x01"
    const log = yield* Effect.gen(function* () {
      if (lineSpec) {
        const range = span(lineSpec)
        if (!range)
          return yield* Effect.fail(new Error(`Could not parse --lines "${lineSpec}". Use "120" or "120,160".`))
        return yield* git.run(["log", format, "-s", `-L${range.start},${range.end}:${file}`], cwd)
      }
      if (term)
        return yield* git.run(["log", format, "--pickaxe-regex", `-S${term}`, ...(file ? ["--", file] : [])], cwd)
      return yield* git.run(["log", format, "--follow", "--", file ?? ""], cwd)
    }).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const found = entries(log.stdout.toString())
    if (!found.length) {
      process.stdout.write("No commits found for that file or term. Nothing to dig through.\n")
      return
    }
    process.stderr.write(`Found ${found.length} relevant commits. Gathering evidence...\n`)
    const patches = yield* Effect.forEach(found.slice(0, PATCHES), (entry) =>
      git.run(["show", "--format=commit %h%nauthor %an%ndate %cd%n%n%s%n%n%b", entry.sha], cwd).pipe(
        Effect.flatMap(AppProcess.requireSuccess),
        Effect.map((result) => result.stdout.toString().slice(0, PATCHCAP)),
      ),
    )
    const older = found
      .slice(PATCHES)
      .map((entry) => `${entry.sha.slice(0, 7)} ${entry.date} ${entry.author}: ${entry.subject}`)
      .join("\n")
    const evidence = `${patches.join("\n---\n")}${older ? `\n---\nOlder commits (subjects only):\n${older}` : ""}`
    if (evidence.length > LIMIT)
      return yield* Effect.fail(
        new Error("Too much history to analyze in one shot. Narrow the dig with --file or --lines."),
      )
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    const text = yield* Effect.tryPromise({
      try: () =>
        answer({
          client,
          title: `bolt why: ${input.question}`,
          agent: "ask",
          model,
          text: `${INSTRUCTIONS}\n\nQuestion: ${input.question}\n\nEvidence:\n${evidence}`,
        }),
      catch: (cause) => cause,
    })
    process.stdout.write(text + "\n")
    const evidenced = cited(
      text,
      found.map((entry) => entry.sha),
    )
    if (!evidenced.length) {
      process.stderr.write("Warning: the answer cites none of the commits in evidence. Treat it as a guess.\n")
      process.exitCode = 1
      return
    }
    process.stderr.write(`Cited commits: ${evidenced.map((sha) => sha.slice(0, 7)).join(", ")}\n`)
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
