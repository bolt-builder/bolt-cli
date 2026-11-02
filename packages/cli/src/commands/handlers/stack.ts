import { Effect, Option, Stream } from "effect"
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

const INSTRUCTIONS = [
  "You are splitting one big branch into an ordered, reviewable stack of pull requests.",
  "The commits below are listed oldest first. Partition them into contiguous groups, keeping the original order, so that each group is one reviewable unit that builds on the groups before it. Do not reorder commits across groups.",
  "Output the plan as a fenced code block. Each group starts with a line `branch: <name> :: <pr title>` where the name is a short lowercase hyphenated branch name, followed by one `- <sha>` line per commit in order.",
].join("\n")

export type Layer = {
  readonly name: string
  readonly title: string
  readonly shas: string[]
}

/** Parse stack layers out of the last fenced code block of an agent response. */
export function layers(text: string) {
  const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)]
  const last = blocks.at(-1)
  if (!last) return undefined
  const found: Layer[] = []
  for (const line of last[1].split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const head = trimmed.match(/^branch:\s*([a-z0-9][a-z0-9-]*)\s*::\s*(.+)$/)
    if (head) {
      found.push({ name: head[1], title: head[2].trim(), shas: [] })
      continue
    }
    const sha = trimmed.match(/^-\s*([0-9a-f]{7,64})$/)
    if (sha) {
      const current = found.at(-1)
      if (!current) return undefined
      current.shas.push(sha[1])
      continue
    }
    return undefined
  }
  if (!found.length) return undefined
  if (found.some((layer) => !layer.shas.length)) return undefined
  return found
}

/** Validate that layers form a contiguous, ordered partition of the branch commits. Returns an error or undefined. */
export function contiguous(plan: Layer[], shas: string[]) {
  const wanted = shas.map((sha) => sha.slice(0, 7))
  const got = plan.flatMap((layer) => layer.shas)
  if (
    got.length !== shas.length ||
    got.some((sha, at) => !shas[at]?.startsWith(sha) || shas.filter((full) => full.startsWith(sha)).length !== 1)
  ) {
    return `plan must list every commit exactly once, oldest first; expected ${wanted.join(", ")} and got ${got.join(", ")}`
  }
  const names = plan.map((layer) => layer.name)
  const dupes = names.filter((name, at) => names.indexOf(name) !== at)
  if (dupes.length) return `plan reuses branch names: ${dupes.join(", ")}`
  return undefined
}

/** Render the `gh pr create` commands for a stack, each based on the branch below it. */
export function commands(plan: Layer[], base: string) {
  return plan.map((layer, at) => {
    const target = at === 0 ? base : plan[at - 1].name
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
    return `gh pr create --head ${layer.name} --base ${quote(target)} --title ${quote(layer.title)}`
  })
}

export default Runtime.handler(Commands.commands.stack, (input) =>
  Effect.gen(function* () {
    const model = Option.getOrUndefined(input.model)
    if (model !== undefined) parseSessionTargetModel(model)
    const git = yield* Git.make
    const app = yield* AppProcess.Service
    const root = yield* git.run(["rev-parse", "--show-toplevel"]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const cwd = root.stdout.toString().trim()
    const base = Option.getOrUndefined(input.base) ?? (yield* git.defaultBranch(cwd))
    if (!base)
      return yield* Effect.fail(new Error("Could not determine the default branch. Pass one with --base <ref>."))
    const target = yield* git
      .run(["rev-parse", "--verify", "--end-of-options", `${base}^{commit}`], cwd)
      .pipe(Effect.flatMap(AppProcess.requireSuccess))
    const head = yield* git.run(["rev-parse", "HEAD"], cwd).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const merge = (yield* git
      .run(["merge-base", head.stdout.toString().trim(), target.stdout.toString().trim()], cwd)
      .pipe(Effect.flatMap(AppProcess.requireSuccess))).stdout
      .toString()
      .trim()
    const log = yield* app.run(
      ChildProcess.make(
        "git",
        ["log", "--reverse", "-z", "--format=%H%x00%s", `${merge}..${head.stdout.toString().trim()}`],
        { cwd },
      ),
      { maxOutputBytes: LIMIT + 1 },
    )
    yield* AppProcess.requireSuccess(log)
    if (log.stdoutTruncated || log.stdout.length > LIMIT)
      return yield* Effect.fail(new Error("Too many commits to plan in one shot. Stack a narrower range."))
    const fields = log.stdout.toString().split("\0")
    const commits = Array.from({ length: Math.floor(fields.length / 2) }, (_, at) => ({
      sha: fields[at * 2],
      subject: fields[at * 2 + 1],
    }))
    if (commits.length < 2) {
      process.stdout.write(`Need at least two commits ahead of ${base} to build a stack.\n`)
      return
    }
    const stats: string[] = []
    for (const commit of commits) {
      const stat = yield* app.run(ChildProcess.make("git", ["show", "--stat", "--format=", commit.sha], { cwd }), {
        maxOutputBytes: LIMIT + 1,
      })
      yield* AppProcess.requireSuccess(stat)
      if (stat.stdoutTruncated || stat.stdout.length > LIMIT)
        return yield* Effect.fail(new Error("Too many commits to plan in one shot. Stack a narrower range."))
      stats.push(`${commit.sha} ${commit.subject}\n${stat.stdout.toString().trim()}`)
      if (stats.join("\n---\n").length > LIMIT)
        return yield* Effect.fail(new Error("Too many commits to plan in one shot. Stack a narrower range."))
    }
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    process.stdout.write(`Planning a stack for ${commits.length} commits on top of ${base}...\n`)
    const text = yield* Effect.tryPromise(() =>
      answer({
        client,
        model,
        agent: "plan",
        directory: cwd,
        title: "bolt stack",
        permissions: [
          { action: "edit", resource: "*", effect: "deny" },
          { action: "shell", resource: "*", effect: "deny" },
          { action: "subagent", resource: "*", effect: "deny" },
          { action: "memory_save", resource: "*", effect: "deny" },
          { action: "task_create", resource: "*", effect: "deny" },
          { action: "task_update", resource: "*", effect: "deny" },
        ],
        text: `${INSTRUCTIONS}\n\nCommits (oldest first):\n${stats.join("\n---\n")}`,
      }),
    )
    const proposed = layers(text)
    if (!proposed) return yield* Effect.fail(new Error("The model did not return a parseable stack plan."))
    const invalid = contiguous(
      proposed,
      commits.map((commit) => commit.sha),
    )
    if (invalid) return yield* Effect.fail(new Error(`The model returned an invalid plan: ${invalid}`))
    const plan = proposed.map((layer) => ({
      ...layer,
      shas: layer.shas.map((sha) => commits.find((commit) => commit.sha.startsWith(sha))!.sha),
    }))
    process.stdout.write("\nStack plan:\n")
    for (const layer of plan) {
      process.stdout.write(`  ${layer.name}: ${layer.title}\n`)
      for (const sha of layer.shas)
        process.stdout.write(`    - ${sha.slice(0, 7)} ${commits.find((commit) => commit.sha === sha)!.subject}\n`)
    }
    if (!input.apply && !input.push) {
      process.stdout.write("\nDry run. Rerun with --apply to create the branches, plus --push to push them.\n")
      return
    }
    for (const layer of plan) {
      if ((yield* git.run(["check-ref-format", "--branch", layer.name], cwd)).exitCode !== 0)
        return yield* Effect.fail(new Error(`Invalid branch name: ${layer.name}`))
      if ((yield* git.run(["show-ref", "--verify", "--quiet", `refs/heads/${layer.name}`], cwd)).exitCode === 0)
        return yield* Effect.fail(new Error(`Branch ${layer.name} already exists. Not touching it.`))
    }
    const transaction = [
      "start",
      ...plan.map((layer) => `create refs/heads/${layer.name} ${layer.shas.at(-1)}`),
      "prepare",
      "commit",
      "",
    ].join("\n")
    yield* app
      .run(
        ChildProcess.make("git", ["update-ref", "--stdin"], {
          cwd,
          stdin: Stream.make(new TextEncoder().encode(transaction)),
        }),
      )
      .pipe(Effect.flatMap(AppProcess.requireSuccess))
    for (const layer of plan) {
      process.stdout.write(`Created ${layer.name} at ${layer.shas.at(-1)!.slice(0, 7)}\n`)
      if (!input.push) continue
      yield* git.run(["push", "-u", "origin", layer.name], cwd).pipe(Effect.flatMap(AppProcess.requireSuccess))
      process.stdout.write(`Pushed ${layer.name}\n`)
    }
    process.stdout.write(
      `\nOpen the stack as pull requests, bottom first:\n${commands(plan, base.replace(/^origin\//, ""))
        .map((command) => `  ${command}`)
        .join("\n")}\n`,
    )
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))),
)
