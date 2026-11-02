import { Effect, Option, Schema } from "effect"
import { ChildProcess } from "effect/process"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { answer } from "../../services/answer"
import { parseSessionTargetModel } from "../../session-target"
import { Git } from "../../services/git"

export type Transform = { pattern: string; rewrite: string; lang?: string }
export type Match = { file: string; line?: number; before: string; after?: string }

const INSTRUCTIONS = [
  "Produce an ast-grep transform for the requested code change in this repository.",
  "Use the glob, grep, and read tools to inspect the codebase so the pattern matches real code, not guessed code.",
  "Patterns and rewrites use ast-grep meta-variables: $NAME matches one node, $$$ARGS matches a list of nodes.",
  'End your final message with exactly one fenced json code block of the shape {"pattern": "...", "rewrite": "...", "lang": "..."} where lang is an ast-grep language identifier such as typescript, tsx, javascript, python, rust, or go.',
].join("\n")

/** Parse the transform out of the agent response: the last fenced json block wins. */
export function parseTransform(text: string): Transform | undefined {
  const fences = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)]
  const last = fences.at(-1)
  if (!last) return undefined
  const parsed = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))(last[1])
  if (parsed._tag === "None") return undefined
  const value = parsed.value
  if (typeof value !== "object" || value === null) return undefined
  const raw = value as Record<string, unknown>
  if (typeof raw.pattern !== "string" || typeof raw.rewrite !== "string" || !raw.pattern) return undefined
  return {
    pattern: raw.pattern,
    rewrite: raw.rewrite,
    lang: typeof raw.lang === "string" && raw.lang ? raw.lang : undefined,
  }
}

/** Build the ast-grep argv for a transform: streamed JSON for preview, --update-all for apply. */
export function buildArgs(input: Transform & { paths?: string[]; apply?: boolean }): string[] {
  return [
    "run",
    "--pattern",
    input.pattern,
    "--rewrite",
    input.rewrite,
    ...(input.lang ? ["--lang", input.lang] : []),
    ...(input.apply ? ["--update-all"] : ["--json=stream"]),
    ...(input.paths ?? []),
  ]
}

/** Parse ast-grep --json=stream output (one JSON match per line) into preview entries. */
export function parsePreview(output: string): Match[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const parsed = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))(line)
      if (parsed._tag === "None") return []
      const value = parsed.value
      if (typeof value !== "object" || value === null) return []
      const match = value as Record<string, unknown>
      if (typeof match.file !== "string" || typeof match.text !== "string") return []
      const range =
        typeof match.range === "object" && match.range !== null ? (match.range as Record<string, unknown>) : {}
      const start =
        typeof range.start === "object" && range.start !== null ? (range.start as Record<string, unknown>) : {}
      return [
        {
          file: match.file,
          line: typeof start.line === "number" ? start.line + 1 : undefined,
          before: match.text,
          after: typeof match.replacement === "string" ? match.replacement : undefined,
        },
      ]
    })
}

/** Render preview entries as a grouped, diff-style listing. */
export function render(matches: Match[]): string {
  const grouped = new Map<string, Match[]>()
  for (const match of matches) {
    const entries = grouped.get(match.file) ?? []
    entries.push(match)
    grouped.set(match.file, entries)
  }
  return [...grouped.entries()]
    .map(([file, entries]) =>
      [
        file,
        ...entries.flatMap((entry) => [
          ...(entry.line === undefined ? [] : [`  @ line ${entry.line}`]),
          ...entry.before.split("\n").map((line) => `  - ${line}`),
          ...(entry.after ?? "").split("\n").map((line) => `  + ${line}`),
        ]),
      ].join("\n"),
    )
    .join("\n\n")
}

export default Runtime.handler(Commands.commands.codemod, (input) =>
  Effect.gen(function* () {
    const pattern = Option.getOrUndefined(input.pattern)
    const rewrite = Option.getOrUndefined(input.rewrite)
    const description = Option.getOrUndefined(input.description)
    if ((pattern === undefined) !== (rewrite === undefined))
      return yield* Effect.fail(new Error("--pattern and --rewrite must be provided together."))
    if (pattern === "" || (pattern === undefined && !description?.trim()))
      return yield* Effect.fail(
        new Error('Describe the transform (bolt codemod "...") or pass --pattern and --rewrite.'),
      )
    const model = Option.getOrUndefined(input.model)
    if (model !== undefined) parseSessionTargetModel(model)
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const cwd = root.stdout.toString().trim()
    const app = yield* AppProcess.Service
    const run = Effect.fn("cli.codemod.process")(function* (binary: string, args: string[]) {
      const result = yield* app.run(ChildProcess.make(binary, args, { cwd }), {
        maxOutputBytes: 2_000_000,
        maxErrorBytes: 2_000_000,
      })
      if (result.stdoutTruncated || result.stderrTruncated)
        return yield* Effect.fail(new Error("ast-grep output exceeds 2 MB; narrow the transform before applying it."))
      return { stdout: result.stdout.toString(), stderr: result.stderr.toString(), code: result.exitCode }
    })
    const binary = Bun.which("ast-grep") ?? Bun.which("sg")
    if (!binary)
      return yield* Effect.fail(new Error("ast-grep is not installed. Install it from https://ast-grep.github.io/"))
    const version = yield* run(binary, ["--version"])
    if (version.code !== 0 || !/^ast-grep\s/.test(version.stdout))
      return yield* Effect.fail(new Error("ast-grep is not installed. Install it from https://ast-grep.github.io/"))
    const transform = yield* Effect.gen(function* () {
      if (pattern !== undefined) return { pattern, rewrite: rewrite!, lang: Option.getOrUndefined(input.lang) }
      process.stdout.write("Generating transform...\n")
      const server = yield* ServerConnection.resolve()
      const client = OpenCode.make({
        baseUrl: server.endpoint.url,
        headers: Service.headers(server.endpoint),
        fetch: noTimeoutFetch,
      })
      const text = yield* Effect.tryPromise(() =>
        answer({
          client,
          model,
          agent: "plan",
          directory: cwd,
          title: "bolt codemod",
          text: `${INSTRUCTIONS}\n\nRequested transform: ${description}`,
          permissions: [
            { action: "edit", resource: "*", effect: "deny" },
            { action: "shell", resource: "*", effect: "deny" },
            { action: "subagent", resource: "*", effect: "deny" },
            { action: "memory_save", resource: "*", effect: "deny" },
            { action: "task_create", resource: "*", effect: "deny" },
            { action: "task_update", resource: "*", effect: "deny" },
          ],
        }),
      )
      const result = parseTransform(text)
      if (!result)
        return yield* Effect.fail(
          new Error("The model did not return a usable transform. Re-run or pass --pattern and --rewrite explicitly."),
        )
      process.stdout.write(
        `pattern: ${result.pattern}\nrewrite: ${result.rewrite}\n${result.lang ? `lang: ${result.lang}\n` : ""}\n`,
      )
      return result
    })
    const preview = yield* run(binary, buildArgs(transform))
    // The CLI uses 1 for no matches; its npm wrapper may still print startup warnings.
    if (preview.code !== 0 && !(preview.code === 1 && !preview.stdout.trim()))
      return yield* Effect.fail(new Error(preview.stderr.trim() || "ast-grep failed"))
    const matches = parsePreview(preview.stdout)
    if (!matches.length) {
      if (preview.stderr.trim()) process.stderr.write(preview.stderr)
      process.stdout.write("No matches found.\n")
      return
    }
    const files = new Set(matches.map((match) => match.file)).size
    process.stdout.write(`${render(matches)}\n\n${matches.length} rewrite(s) in ${files} file(s).\n`)
    if (!input.apply) {
      process.stdout.write("Preview only. Re-run with --apply to write these changes.\n")
      return
    }
    const applied = yield* run(binary, buildArgs({ ...transform, apply: true }))
    if (applied.code !== 0)
      return yield* Effect.fail(new Error(applied.stderr.trim() || "ast-grep failed while applying"))
    process.stdout.write(`Applied ${matches.length} rewrite(s) across ${files} file(s).\n`)
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))),
)
