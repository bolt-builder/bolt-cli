import path from "node:path"
import os from "node:os"
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

const LIMIT = 60_000

const ACTIONS = ["pick", "reword", "squash", "fixup", "drop"] as const

export type Action = (typeof ACTIONS)[number]

export type Step = {
  readonly action: Action
  readonly sha: string
  readonly subject?: string
  readonly note: string
}

const INSTRUCTIONS = [
  "You are planning an interactive git rebase. The commits below are listed oldest first.",
  "Decide, for each commit, whether to pick, reword, squash, fixup, or drop it. Squash fixup-style commits into the change they amend, drop dead experiments, and reword vague subjects. Keep the plan conservative: when in doubt, pick.",
  'Output the plan as a fenced code block. One line per commit, oldest first, in the form `<action> <sha> :: <explanation>`. For reword, include the new subject in double quotes: `reword <sha> "new subject" :: <explanation>`. Every input commit must appear exactly once, and the first non-drop line must be pick or reword.',
].join("\n")

/** Parse the rebase plan out of the last fenced code block of an agent response. */
export function plan(text: string) {
  const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)]
  const last = blocks.at(-1)
  if (!last) return undefined
  const steps: Step[] = []
  for (const line of last[1].split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(
      /^(pick|reword|squash|fixup|drop)\s+([0-9a-f]{7,64})(?:\s+"((?:[^"\\]|\\.)*)")?\s*::\s*(.*)$/,
    )
    if (!match) return undefined
    steps.push({
      action: match[1] as Action,
      sha: match[2],
      ...(match[3] === undefined ? {} : { subject: match[3].replace(/\\(.)/g, "$1") }),
      note: match[4].trim(),
    })
  }
  if (!steps.length) return undefined
  return steps
}

/** Validate a plan against the commits being rebased. Returns an error message or undefined. */
export function check(steps: Step[], shas: string[]) {
  const short = (sha: string) => sha.slice(0, 7)
  const resolved = steps.map((step) => shas.filter((sha) => sha.startsWith(step.sha)))
  if (resolved.some((matches) => matches.length > 1)) return "plan uses ambiguous commit prefixes; use longer hashes"
  const missing = shas.filter((sha) => !resolved.some((matches) => matches[0] === sha))
  if (missing.length) return `plan is missing commits: ${missing.map(short).join(", ")}`
  const unknown = steps.filter((_, at) => !resolved[at].length)
  if (unknown.length) return `plan references unknown commits: ${unknown.map((step) => step.sha).join(", ")}`
  const got = resolved.map((matches) => matches[0])
  const dupes = got.filter((sha, at) => got.indexOf(sha) !== at)
  if (dupes.length) return `plan lists commits more than once: ${dupes.map(short).join(", ")}`
  const first = steps.find((step) => step.action !== "drop")
  if (first && (first.action === "squash" || first.action === "fixup")) {
    return `the first kept commit cannot be a ${first.action}`
  }
  const reworded = steps.find((step) => step.action === "reword" && !step.subject?.trim())
  if (reworded) return `reword for ${short(reworded.sha)} is missing a new subject`
  return undefined
}

/** Serialize a validated plan into a git rebase todo file. Rewords become pick + exec amend so no editor is needed. */
export function todo(steps: Step[]) {
  return steps
    .flatMap((step) => {
      if (step.action === "reword") {
        const subject = `'${(step.subject ?? "").replaceAll("'", "'\\''")}'`
        return [`pick ${step.sha}`, `exec git commit --amend -m ${subject}`]
      }
      return [`${step.action} ${step.sha}`]
    })
    .join("\n")
    .concat("\n")
}

export default Runtime.handler(Commands.commands.rebase, (input) =>
  Effect.gen(function* () {
    const model = Option.getOrUndefined(input.model)
    if (model !== undefined) parseSessionTargetModel(model)
    const git = yield* Git.make
    const app = yield* AppProcess.Service
    const root = yield* git.run(["rev-parse", "--show-toplevel"]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const cwd = root.stdout.toString().trim()
    const base = Option.getOrUndefined(input.onto) ?? (yield* git.defaultBranch(cwd))
    if (!base)
      return yield* Effect.fail(new Error("Could not determine the default branch. Pass one with --onto <ref>."))
    const target = yield* git
      .run(["rev-parse", "--verify", "--end-of-options", `${base}^{commit}`], cwd)
      .pipe(Effect.flatMap(AppProcess.requireSuccess))
    const head = yield* git.run(["rev-parse", "HEAD"], cwd).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const merge = (yield* git
      .run(["merge-base", head.stdout.toString().trim(), target.stdout.toString().trim()], cwd)
      .pipe(Effect.flatMap(AppProcess.requireSuccess))).stdout
      .toString()
      .trim()
    const range = `${merge}..${head.stdout.toString().trim()}`
    const output = yield* app.run(
      ChildProcess.make("git", ["log", "--reverse", "-z", "--format=%H%x00%s%x00%b", range], { cwd }),
      { maxOutputBytes: LIMIT + 1 },
    )
    yield* AppProcess.requireSuccess(output)
    if (output.stdoutTruncated || output.stdout.length > LIMIT)
      return yield* Effect.fail(new Error("Too many commits to plan in one shot. Rebase a narrower range."))
    const fields = output.stdout.toString().split("\0")
    const commits = Array.from({ length: Math.floor(fields.length / 3) }, (_, at) => ({
      sha: fields[at * 3],
      subject: fields[at * 3 + 1],
      body: fields[at * 3 + 2],
    }))
    if (!commits.length) {
      process.stdout.write(`Nothing to rebase: HEAD does not diverge from ${base}.\n`)
      return
    }
    if (commits.length === 1) {
      process.stdout.write("Only one commit ahead of the base. Nothing worth rebasing.\n")
      return
    }
    const merges = yield* git.run(["rev-list", "--merges", range], cwd).pipe(Effect.flatMap(AppProcess.requireSuccess))
    if (merges.stdout.toString().trim())
      return yield* Effect.fail(
        new Error("This range contains merge commits. Choose a linear range before planning a rebase."),
      )
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    process.stdout.write(`Planning a rebase of ${commits.length} commits onto ${base}...\n`)
    const text = yield* Effect.tryPromise(() =>
      answer({
        client,
        model,
        agent: "plan",
        directory: cwd,
        title: "bolt rebase",
        permissions: [
          { action: "edit", resource: "*", effect: "deny" },
          { action: "shell", resource: "*", effect: "deny" },
          { action: "subagent", resource: "*", effect: "deny" },
          { action: "memory_save", resource: "*", effect: "deny" },
          { action: "task_create", resource: "*", effect: "deny" },
          { action: "task_update", resource: "*", effect: "deny" },
        ],
        text: `${INSTRUCTIONS}\n\nCommits (oldest first):\n${commits.map((commit) => `${commit.sha} ${commit.subject}\n${commit.body}`).join("\n---\n")}`,
      }),
    )
    const steps = plan(text)
    if (!steps) return yield* Effect.fail(new Error("The model did not return a parseable rebase plan."))
    const invalid = check(
      steps,
      commits.map((commit) => commit.sha),
    )
    if (invalid) return yield* Effect.fail(new Error(`The model returned an invalid plan: ${invalid}`))
    const resolved = steps.map((step) => ({
      ...step,
      sha: commits.find((commit) => commit.sha.startsWith(step.sha))!.sha,
    }))
    process.stdout.write("\nRebase plan:\n")
    for (const step of resolved)
      process.stdout.write(
        `  ${step.action.padEnd(6)} ${step.sha.slice(0, 7)} ${step.subject ?? commits.find((commit) => commit.sha === step.sha)!.subject}\n         ${step.note}\n`,
      )
    if (!input.apply) {
      process.stdout.write(
        "\nDry run. Rerun with --apply to execute this plan. It rewrites local history and never pushes.\n",
      )
      return
    }
    const current = yield* git.run(["rev-parse", "HEAD"], cwd).pipe(Effect.flatMap(AppProcess.requireSuccess))
    if (!current.stdout.equals(head.stdout))
      return yield* Effect.fail(new Error("HEAD changed while planning. Rerun to preserve the new commits."))
    const status = yield* git.run(["status", "--porcelain=v1"], cwd).pipe(Effect.flatMap(AppProcess.requireSuccess))
    if (status.stdout.length)
      return yield* Effect.fail(
        new Error("The worktree has uncommitted changes. Commit or stash them before rebasing."),
      )
    yield* Effect.scoped(
      Effect.gen(function* () {
        const directory = yield* Effect.acquireRelease(
          Effect.tryPromise(() => fs.mkdtemp(path.join(os.tmpdir(), "bolt-rebase-"))),
          (directory) => Effect.promise(() => fs.rm(directory, { recursive: true, force: true })),
        )
        const file = path.join(directory, "plan.todo")
        const editor = path.join(directory, "editor.sh")
        const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
        yield* Effect.tryPromise(async () => {
          await fs.writeFile(file, todo(resolved), { mode: 0o600 })
          await fs.writeFile(editor, `#!/bin/sh\ncat ${quote(file.replaceAll("\\", "/"))} > "$1"\n`, { mode: 0o600 })
        })
        process.stdout.write("Executing the plan...\n")
        const run = yield* app.run(
          ChildProcess.make("git", ["rebase", "-i", merge], {
            cwd,
            extendEnv: true,
            env: { GIT_SEQUENCE_EDITOR: `sh ${quote(editor.replaceAll("\\", "/"))}`, GIT_EDITOR: "true" },
          }),
          { maxOutputBytes: 100_000, maxErrorBytes: 100_000 },
        )
        if (run.exitCode !== 0) {
          const aborted = yield* git.run(["rebase", "--abort"], cwd)
          return yield* Effect.fail(
            new Error(
              `${run.stderr.toString().trim() || "git rebase failed"}\n${aborted.exitCode === 0 ? "The rebase was aborted; your branch is unchanged." : "Automatic abort failed. Run git rebase --abort and inspect the worktree."}`,
            ),
          )
        }
        const after = yield* git
          .run(["log", "--oneline", `${merge}..HEAD`], cwd)
          .pipe(Effect.flatMap(AppProcess.requireSuccess))
        process.stdout.write(
          `\nRebase complete. New history:\n${after.stdout.toString().trim()}\nNothing was pushed. Review the result before pushing.\n`,
        )
      }),
    )
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))),
)
