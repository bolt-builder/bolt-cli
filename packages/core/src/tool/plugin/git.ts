export * as GitTool from "./git.js"

import { Effect, Schema } from "effect"
import { collectStream } from "@opencode/util/process"
import { ChildProcess } from "effect/process"
import { ToolFailure } from "@opencode/ai/effect"
import type { Context } from "@opencode/plugin/effect/plugin"
import { Environment } from "../../environment/index.js"
import { Location } from "../../location.js"
import { FileAccess } from "../../file-access.js"
import { Permission } from "../../permission.js"
import DESCRIPTION from "./git.txt"
const MAX_PATCH = 40_000
const DEFAULT_LOG_COUNT = 20

// NUL separates fields and records; commit subjects can contain record-separator bytes.
const LOG_FORMAT = "%H%x00%an%x00%aI%x00%s"
const MAX_GIT_OUTPUT_BYTES = 2 * 1024 * 1024

export type StatusEntry = {
  path: string
  status: string
  from?: string
}

/** Human-readable name for a porcelain v2 status letter. */
function statusName(letter: string) {
  if (letter === "M") return "modified"
  if (letter === "A") return "added"
  if (letter === "D") return "deleted"
  if (letter === "R") return "renamed"
  if (letter === "C") return "copied"
  if (letter === "T") return "typechange"
  return letter
}

/**
 * Parse `git status --porcelain=v2 -z` output into staged/unstaged/untracked
 * buckets. Rename and copy records ("2") carry the original path in the next
 * NUL-separated token.
 */
export function parseStatus(text: string) {
  const tokens = text.split("\0").filter((token) => token.length > 0)
  const staged: StatusEntry[] = []
  const unstaged: StatusEntry[] = []
  const untracked: string[] = []
  let index = 0
  while (index < tokens.length) {
    const record = tokens[index]
    index++
    if (record.startsWith("? ")) {
      untracked.push(record.slice(2))
      continue
    }
    if (record.startsWith("1 ")) {
      const fields = record.split(" ")
      const xy = fields[1]
      const file = fields.slice(8).join(" ")
      if (xy[0] !== ".") staged.push({ path: file, status: statusName(xy[0]) })
      if (xy[1] !== ".") unstaged.push({ path: file, status: statusName(xy[1]) })
      continue
    }
    if (record.startsWith("2 ")) {
      const fields = record.split(" ")
      const xy = fields[1]
      const file = fields.slice(9).join(" ")
      const from = tokens[index]
      index++
      if (xy[0] !== ".") staged.push({ path: file, status: statusName(xy[0]), from })
      if (xy[1] !== ".") unstaged.push({ path: file, status: statusName(xy[1]), from })
      continue
    }
    if (record.startsWith("u ")) {
      const fields = record.split(" ")
      unstaged.push({ path: fields.slice(10).join(" "), status: "conflicted" })
      continue
    }
  }
  return { staged, unstaged, untracked }
}

export type FilePatch = {
  file: string
  hunks: number
  additions: number
  deletions: number
}

/** Summarize unified diff text into per-file hunk and line-change counts. */
export function parsePatch(text: string): FilePatch[] {
  const files: FilePatch[] = []
  for (const line of text.split("\n")) {
    const header = line.match(/^diff --git a\/.* b\/(.*)$/)
    if (header) {
      files.push({ file: header[1], hunks: 0, additions: 0, deletions: 0 })
      continue
    }
    const current = files[files.length - 1]
    if (!current) continue
    if (line.startsWith("@@")) {
      current.hunks++
      continue
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      current.additions++
      continue
    }
    if (line.startsWith("-") && !line.startsWith("---")) current.deletions++
  }
  return files
}

export type LogEntry = {
  sha: string
  author: string
  date: string
  subject: string
}

/** Parse log output produced with LOG_FORMAT into structured entries. */
export function parseLog(text: string): LogEntry[] {
  if (text.includes("\0")) {
    const fields = text.split("\0")
    const records: LogEntry[] = []
    for (let index = 0; index + 3 < fields.length; index += 4) {
      if (!fields[index]) continue
      records.push({
        sha: fields[index],
        author: fields[index + 1],
        date: fields[index + 2],
        subject: fields[index + 3],
      })
    }
    return records
  }
  return text
    .split("\x1e")
    .map((record) => record.replace(/^\n/, ""))
    .filter((record) => record.length > 0)
    .map((record) => {
      const fields = record.split("\x1f")
      return { sha: fields[0] ?? "", author: fields[1] ?? "", date: fields[2] ?? "", subject: fields[3] ?? "" }
    })
    .filter((entry) => entry.sha.length > 0)
}

export type BlameLine = {
  line: number
  sha: string
  author: string
  content: string
}

/**
 * Parse `git blame --porcelain` output into per-line attributions. Commit
 * headers (author, etc.) appear once per sha, so they are cached and reused
 * for later lines attributed to the same commit.
 */
export function parseBlame(text: string): BlameLine[] {
  const authors = new Map<string, string>()
  const out: BlameLine[] = []
  let sha = ""
  let final = 0
  for (const line of text.split("\n")) {
    if (line.startsWith("\t")) {
      out.push({ line: final, sha, author: authors.get(sha) ?? "", content: line.slice(1) })
      continue
    }
    const header = line.match(/^([0-9a-f]{40}) \d+ (\d+)(?: \d+)?$/)
    if (header) {
      sha = header[1]
      final = Number(header[2])
      continue
    }
    if (line.startsWith("author ")) authors.set(sha, line.slice("author ".length))
  }
  return out
}

function cap(text: string) {
  if (text.length <= MAX_PATCH) return text
  return `${text.slice(0, MAX_PATCH)}\n(truncated: showing first ${MAX_PATCH} of ${text.length} characters)`
}

function renderStatusEntry(entry: StatusEntry) {
  if (entry.from) return `- ${entry.status} ${entry.path} (from ${entry.from})`
  return `- ${entry.status} ${entry.path}`
}

function renderFilePatch(file: FilePatch) {
  return `- ${file.file} (${file.hunks} hunk${file.hunks === 1 ? "" : "s"}, +${file.additions} -${file.deletions})`
}

export const Input = Schema.Struct({
  action: Schema.Literals(["status", "diff", "log", "blame", "show"]).annotate({
    description: "The git query to run",
  }),
  path: Schema.optional(Schema.String).annotate({
    description: "Optional file or directory to scope diff/log to. Required for blame.",
  }),
  staged: Schema.optional(Schema.Boolean).annotate({
    description: "For diff: compare the index against HEAD instead of the working tree",
  }),
  count: Schema.optional(Schema.Number).annotate({
    description: `For log: number of commits to return (default ${DEFAULT_LOG_COUNT})`,
  }),
  sha: Schema.optional(Schema.String).annotate({ description: "For show: the commit sha (or any revision) to show" }),
  start: Schema.optional(Schema.Number).annotate({ description: "For blame: first line of the range (1-indexed)" }),
  end: Schema.optional(Schema.Number).annotate({ description: "For blame: last line of the range (inclusive)" }),
})

export const name = "git"
export const Plugin = {
  id: "bolt.tool.git",
  effect: Effect.fn("GitTool.Plugin")(function* (ctx: Context) {
    const environment = yield* Environment.Service
    const location = yield* Location.Service
    const access = yield* FileAccess.Service
    const permission = yield* Permission.Service
    const run = Effect.fn("GitTool.run")(function* (args: string[], cwd: string) {
      const handle = yield* environment.spawner.spawn(
        ChildProcess.make(
          "git",
          ["--no-pager", "--no-lazy-fetch", "--no-optional-locks", "-c", "core.fsmonitor=false", ...args],
          {
            cwd,
            extendEnv: true,
            env: { GIT_NO_LAZY_FETCH: "1" },
            stdin: "ignore",
          },
        ),
      )
      const [stdout, stderr, code] = yield* Effect.all(
        [
          collectStream(handle.stdout, MAX_GIT_OUTPUT_BYTES),
          collectStream(handle.stderr, MAX_GIT_OUTPUT_BYTES),
          handle.exitCode,
        ],
        { concurrency: "unbounded" },
      )
      if (code !== 0)
        return yield* Effect.fail(
          new ToolFailure({
            message: `git ${args[0]} failed (exit ${code}): ${stderr.buffer.toString().trim() || stdout.buffer.toString().trim()}`,
          }),
        )
      return { text: stdout.buffer.toString(), truncated: stdout.truncated || stderr.truncated }
    }, Effect.scoped)
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name,
          options: { codemode: false },
          description: DESCRIPTION,
          input: Input,
          output: Schema.String,
          execute: (params, context) =>
            Effect.gen(function* () {
              const cwd = location.directory
              let truncated = false
              const read = (args: string[]) =>
                run(args, cwd).pipe(
                  Effect.map((result) => {
                    truncated ||= result.truncated
                    return result.text
                  }),
                )
              if (params.path) {
                const target = yield* access.resolve({ path: params.path, kind: "file" })
                yield* access.authorizeExternal([target], context)
              }
              yield* permission.assert({
                action: name,
                resources: [params.action],
                save: ["*"],
                metadata: params,
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.messageID, id: context.id },
              })
              const result = yield* Effect.gen(function* () {
                if (params.action === "status") {
                  const parsed = parseStatus(yield* read(["status", "--porcelain=v2", "-z"]))
                  const lines: string[] = []
                  if (parsed.staged.length) lines.push("staged:", ...parsed.staged.map(renderStatusEntry))
                  if (parsed.unstaged.length) lines.push("unstaged:", ...parsed.unstaged.map(renderStatusEntry))
                  if (parsed.untracked.length) lines.push("untracked:", ...parsed.untracked.map((file) => `- ${file}`))
                  return {
                    title: "git status",
                    output: lines.length ? lines.join("\n") : "working tree clean",
                    metadata: {
                      staged: parsed.staged.length,
                      unstaged: parsed.unstaged.length,
                      untracked: parsed.untracked.length,
                    },
                  }
                }

                if (params.action === "diff") {
                  const args = [
                    "diff",
                    "--no-ext-diff",
                    "--no-textconv",
                    ...(params.staged ? ["--cached"] : []),
                    ...(params.path ? ["--", params.path] : []),
                  ]
                  const patch = yield* read(args)
                  const files = parsePatch(patch)
                  if (files.length === 0) {
                    return {
                      title: `git diff${params.staged ? " --cached" : ""}`,
                      output: "no changes",
                      metadata: { files: 0, staged: params.staged ?? false },
                    }
                  }
                  const additions = files.reduce((acc, file) => acc + file.additions, 0)
                  const deletions = files.reduce((acc, file) => acc + file.deletions, 0)
                  return {
                    title: `git diff${params.staged ? " --cached" : ""} (${files.length} file${files.length === 1 ? "" : "s"})`,
                    output: [
                      `files changed: ${files.length} (+${additions} -${deletions})`,
                      ...files.map(renderFilePatch),
                      "",
                      cap(patch),
                    ].join("\n"),
                    metadata: { files: files.length, additions, deletions, staged: params.staged ?? false },
                  }
                }

                if (params.action === "log") {
                  const count = params.count ?? DEFAULT_LOG_COUNT
                  const args = [
                    "log",
                    "-z",
                    "-n",
                    String(count),
                    `--format=${LOG_FORMAT}`,
                    ...(params.path ? ["--", params.path] : []),
                  ]
                  const entries = parseLog(yield* read(args))
                  return {
                    title: `git log (${entries.length} commit${entries.length === 1 ? "" : "s"})`,
                    output: entries.length
                      ? entries
                          .map((entry) => `${entry.sha.slice(0, 8)} ${entry.date} ${entry.author}: ${entry.subject}`)
                          .join("\n")
                      : "no commits",
                    metadata: { entries },
                  }
                }

                if (params.action === "blame") {
                  if (!params.path)
                    return yield* Effect.fail(new ToolFailure({ message: "blame requires the path parameter" }))
                  const range = params.start !== undefined && params.end !== undefined
                  const args = [
                    "blame",
                    "--no-textconv",
                    "--porcelain",
                    ...(range ? ["-L", `${params.start},${params.end}`] : []),
                    "--",
                    params.path,
                  ]
                  const lines = parseBlame(yield* read(args))
                  return {
                    title: `git blame ${params.path}`,
                    output: lines.length
                      ? lines
                          .map(
                            (line) =>
                              `${String(line.line).padStart(5)} ${line.sha.slice(0, 8)} ${line.author}: ${line.content}`,
                          )
                          .join("\n")
                      : "no lines",
                    metadata: { lines: lines.length, path: params.path },
                  }
                }

                if (!params.sha)
                  return yield* Effect.fail(new ToolFailure({ message: "show requires the sha parameter" }))
                const revision = (yield* read([
                  "rev-parse",
                  "--verify",
                  "--end-of-options",
                  `${params.sha}^{commit}`,
                ])).trim()
                const meta = parseLog(yield* read(["show", "-z", "-s", `--format=${LOG_FORMAT}`, revision]))
                const entry = meta[0]
                if (!entry) return yield* Effect.fail(new ToolFailure({ message: `no commit found for ${params.sha}` }))
                const patch = yield* read(["show", "--no-ext-diff", "--no-textconv", "--format=", "--patch", revision])
                const files = parsePatch(patch)
                return {
                  title: `git show ${entry.sha.slice(0, 8)}`,
                  output: [
                    `commit ${entry.sha}`,
                    `author ${entry.author}`,
                    `date ${entry.date}`,
                    `subject ${entry.subject}`,
                    "",
                    ...files.map(renderFilePatch),
                    "",
                    cap(patch),
                  ].join("\n"),
                  metadata: { sha: entry.sha, files: files.length },
                }
              })
              const output = truncated
                ? `${result.output}\n\n(Git output truncated at ${MAX_GIT_OUTPUT_BYTES} bytes.)`
                : result.output
              return {
                output,
                content: output,
                metadata: { ...result.metadata, title: result.title, truncated },
              }
            }).pipe(
              Effect.mapError((error) =>
                error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to query git", error }),
              ),
            ),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
