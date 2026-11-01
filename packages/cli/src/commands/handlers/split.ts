import path from "node:path"
import fs from "node:fs/promises"
import { Effect, Option } from "effect"
import { ChildProcess } from "effect/process"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Git } from "../../services/git"
import { ServerConnection } from "../../services/server-connection"
import { answer } from "../../services/answer"
import { parseSessionTargetModel } from "../../session-target"

const LIMIT = 80_000
const FILECAP = 6_000

const INSTRUCTIONS = [
  "You are splitting a messy worktree into logical commits: one coherent change per commit.",
  "Group the changed files below so that each group is a single logical change that would make sense as one commit. Order the groups so earlier commits do not depend on later ones. Every file must appear in exactly one group.",
  "Output the plan as a fenced code block. Each group starts with a line `commit: <message>` using this repo's commit message conventions, followed by one `- <file>` line per file.",
].join("\n")

export type Change = {
  readonly file: string
  readonly code: string
}

export type Group = {
  readonly message: string
  readonly files: string[]
}

/** Parse changed paths out of `git status --porcelain=v1`, skipping unmerged entries. */
export function changes(text: string) {
  const skip = ["DD", "AU", "UD", "UA", "DU", "AA", "UU"]
  return text
    .split("\n")
    .filter((line) => line.length > 3)
    .filter((line) => !skip.includes(line.slice(0, 2)))
    .map((line) => {
      const code = line.slice(0, 2)
      const rest = line.slice(3).trim()
      const arrow = rest.indexOf(" -> ")
      return { file: arrow === -1 ? rest : rest.slice(arrow + 4), code } satisfies Change
    })
    .filter((change) => Boolean(change.file))
}

/** Parse commit groups out of the last fenced code block of an agent response. */
export function groups(text: string) {
  const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)]
  const last = blocks.at(-1)
  if (!last) return undefined
  const found: Group[] = []
  for (const line of last[1].split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.toLowerCase().startsWith("commit:")) {
      const message = trimmed.slice(7).trim()
      if (!message) return undefined
      found.push({ message, files: [] })
      continue
    }
    if (trimmed.startsWith("- ")) {
      const current = found.at(-1)
      if (!current) return undefined
      const file = trimmed.slice(2).trim()
      if (!file) return undefined
      current.files.push(file)
      continue
    }
    return undefined
  }
  if (!found.length) return undefined
  if (found.some((group) => !group.files.length)) return undefined
  return found
}

/** Validate that a plan covers every changed file exactly once. Returns an error message or undefined. */
export function cover(plan: Group[], files: string[]) {
  const listed = plan.flatMap((group) => group.files)
  const missing = files.filter((file) => !listed.includes(file))
  if (missing.length) return `plan is missing files: ${missing.join(", ")}`
  const unknown = listed.filter((file) => !files.includes(file))
  if (unknown.length) return `plan references unknown files: ${unknown.join(", ")}`
  const dupes = listed.filter((file, at) => listed.indexOf(file) !== at)
  if (dupes.length) return `plan lists files more than once: ${dupes.join(", ")}`
  return undefined
}

export default Runtime.handler(Commands.commands.split, (input) =>
  Effect.gen(function* () {
    const model = Option.getOrUndefined(input.model)
    if (model !== undefined) parseSessionTargetModel(model)
    const git = yield* Git.make
    const app = yield* AppProcess.Service
    const root = yield* git.run(["rev-parse", "--show-toplevel"]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const cwd = root.stdout.toString().trim()
    const status = yield* git
      .run(["status", "--porcelain=v1", "-z", "--untracked-files=all"], cwd)
      .pipe(Effect.flatMap(AppProcess.requireSuccess))
    const records = status.stdout.toString().split("\0").filter(Boolean)
    const changed: { file: string; code: string; from?: string }[] = []
    for (let at = 0; at < records.length; at++) {
      const record = records[at]
      const code = record.slice(0, 2)
      if (["DD", "AU", "UD", "UA", "DU", "AA", "UU"].includes(code))
        return yield* Effect.fail(new Error("Resolve merge conflicts before splitting commits."))
      const from = /[RC]/.test(code) ? records[++at] : undefined
      changed.push({ file: record.slice(3), code, ...(from === undefined ? {} : { from }) })
    }
    if (!changed.length) {
      process.stdout.write("The worktree is clean. Nothing to split.\n")
      return
    }
    if (changed.length === 1) {
      process.stdout.write("Only one file changed. Nothing to split; use bolt commit instead.\n")
      return
    }
    if (changed.some((change) => /[\r\n]/.test(change.file)))
      return yield* Effect.fail(
        new Error("Commit plans cannot represent filenames containing line breaks. Commit those files separately."),
      )
    const head = yield* git.run(["rev-parse", "--verify", "HEAD"], cwd)
    const base =
      head.exitCode === 0
        ? head.stdout.toString().trim()
        : (yield* app
            .run(ChildProcess.make("git", ["hash-object", "-t", "tree", "--stdin"], { cwd, stdin: "ignore" }))
            .pipe(Effect.flatMap(AppProcess.requireSuccess))).stdout
            .toString()
            .trim()
    const patches: string[] = []
    const fingerprints: string[] = []
    const fingerprint = (change: (typeof changed)[number]) =>
      git
        .run(["hash-object", "--no-filters", "--", change.file], cwd)
        .pipe(Effect.map((result) => `${result.exitCode}:${result.stdout.toString()}`))
    for (const change of changed) {
      fingerprints.push(yield* fingerprint(change))
      if (change.code === "??") {
        const content = yield* Effect.tryPromise(async () => {
          const handle = await fs.open(path.join(cwd, change.file), "r")
          try {
            const bytes = Buffer.alloc(FILECAP + 1)
            const result = await handle.read(bytes, 0, bytes.length, 0)
            return bytes.subarray(0, result.bytesRead)
          } finally {
            await handle.close()
          }
        })
        patches.push(
          `new file ${change.file}:\n${content.subarray(0, FILECAP).toString()}${content.length > FILECAP ? "\n[source excerpt truncated]" : ""}`,
        )
      } else {
        const diff = yield* app.run(
          ChildProcess.make("git", ["diff", base, "--", change.file, ...(change.from ? [change.from] : [])], { cwd }),
          { maxOutputBytes: FILECAP + 1 },
        )
        yield* AppProcess.requireSuccess(diff)
        patches.push(
          `${change.file}:\n${diff.stdout.subarray(0, FILECAP).toString()}${diff.stdoutTruncated || diff.stdout.length > FILECAP ? "\n[source excerpt truncated]" : ""}`,
        )
      }
      if (patches.join("\n---\n").length > LIMIT)
        return yield* Effect.fail(
          new Error("The worktree diff is too large to split in one shot. Commit some of it first."),
        )
    }
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    process.stdout.write(`Planning commits for ${changed.length} changed files...\n`)
    const text = yield* Effect.tryPromise(() =>
      answer({
        client,
        model,
        agent: "plan",
        directory: cwd,
        title: "bolt split",
        permissions: [
          { action: "edit", resource: "*", effect: "deny" },
          { action: "shell", resource: "*", effect: "deny" },
          { action: "subagent", resource: "*", effect: "deny" },
          { action: "memory_save", resource: "*", effect: "deny" },
          { action: "task_create", resource: "*", effect: "deny" },
          { action: "task_update", resource: "*", effect: "deny" },
        ],
        text: `${INSTRUCTIONS}\n\nChanged files with diffs (large excerpts are labeled):\n${patches.join("\n---\n")}`,
      }),
    )
    const plan = groups(text)
    if (!plan) return yield* Effect.fail(new Error("The model did not return a parseable commit plan."))
    const invalid = cover(
      plan,
      changed.map((change) => change.file),
    )
    if (invalid) return yield* Effect.fail(new Error(`The model returned an invalid plan: ${invalid}`))
    process.stdout.write("\nCommit plan:\n")
    for (const group of plan)
      process.stdout.write(`  ${group.message}\n${group.files.map((file) => `    - ${file}`).join("\n")}\n`)
    if (!input.apply) {
      process.stdout.write("\nDry run. Rerun with --apply to create these commits. Nothing is ever pushed.\n")
      return
    }
    const now = yield* git
      .run(["status", "--porcelain=v1", "-z", "--untracked-files=all"], cwd)
      .pipe(Effect.flatMap(AppProcess.requireSuccess))
    const current = yield* git.run(["rev-parse", "--verify", "HEAD"], cwd)
    const hashes = yield* Effect.forEach(changed, fingerprint)
    if (
      !now.stdout.equals(status.stdout) ||
      !current.stdout.equals(head.stdout) ||
      hashes.some((hash, at) => hash !== fingerprints[at])
    )
      return yield* Effect.fail(
        new Error("The worktree or HEAD changed while planning. Rerun to include those changes."),
      )
    yield* git
      .run(head.exitCode === 0 ? ["reset", "--mixed", "HEAD"] : ["read-tree", "--empty"], cwd)
      .pipe(Effect.flatMap(AppProcess.requireSuccess))
    for (const group of plan) {
      const files = group.files.flatMap((file) => {
        const change = changed.find((change) => change.file === file)!
        return [file, ...(change.from ? [change.from] : [])]
      })
      yield* git.run(["add", "-A", "--", ...files], cwd).pipe(Effect.flatMap(AppProcess.requireSuccess))
      const committed = yield* git.run(["commit", "-m", group.message], cwd)
      if (committed.exitCode !== 0)
        return yield* Effect.fail(
          new Error(
            `Failed to commit "${group.message}": ${committed.stderr.toString().trim()}\nEarlier commits are retained; this group's files remain staged. Nothing was pushed.`,
          ),
        )
      process.stdout.write(`Committed: ${group.message}\n`)
    }
    process.stdout.write("All commits created. Nothing was pushed.\n")
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))),
)
