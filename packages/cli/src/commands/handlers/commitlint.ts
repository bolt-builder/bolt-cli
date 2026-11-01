import { Effect, Option } from "effect"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Git } from "../../services/git"
import { errorMessage } from "../../util/error"

const println = (text = "") => process.stdout.write(text + "\n")

export type Parsed = {
  readonly type?: string
  readonly scope?: string
  readonly summary: string
}

export type Convention = {
  readonly conventional: boolean
  readonly types: string[]
  readonly scopes: string[]
  readonly length: number
  readonly period: boolean
  readonly lower: boolean
}

/** Parse a commit subject into conventional-commit parts. Freeform subjects parse as summary only. */
export function subject(line: string): Parsed {
  const match = line.match(/^([a-z]+)(?:\(([^)]*)\))?!?:\s+(.*)$/)
  if (!match) return { summary: line } satisfies Parsed
  return {
    type: match[1],
    ...(match[2] === undefined ? {} : { scope: match[2] }),
    summary: match[3],
  } satisfies Parsed
}

/** Infer the repo's commit subject conventions from a sample of history subjects. */
export function convention(history: string[]) {
  const parsed = history.map(subject)
  const typed = parsed.filter((entry) => entry.type !== undefined)
  const conventional = history.length > 0 && typed.length >= history.length / 2

  const count = (values: string[]) =>
    values.reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1
      return acc
    }, {})
  const keep = (tally: Record<string, number>, floor: number) =>
    Object.keys(tally)
      .filter((key) => tally[key] >= floor)
      .sort()

  const types = keep(count(typed.map((entry) => entry.type ?? "")), Math.max(2, history.length * 0.02))
  const scoped = typed.map((entry) => entry.scope).filter((scope): scope is string => scope !== undefined)
  const scopes = keep(count(scoped), Math.max(2, history.length * 0.02))

  const lengths = history.map((line) => line.length).sort((a, b) => a - b)
  const p95 = lengths.length ? lengths[Math.min(lengths.length - 1, Math.floor(lengths.length * 0.95))] : 72
  const period = history.filter((line) => line.endsWith(".")).length > history.length * 0.2
  const summaries = parsed.map((entry) => entry.summary).filter(Boolean)
  const lower =
    summaries.length > 0 &&
    summaries.filter((line) => line[0] === line[0].toLowerCase()).length >= summaries.length * 0.8

  return {
    conventional,
    types,
    scopes,
    length: Math.max(50, p95),
    period,
    lower,
  } satisfies Convention
}

/** Lint one commit subject against the inferred convention. Returns violation strings. */
export function lint(line: string, rules: Convention) {
  const found: string[] = []
  const parsed = subject(line)
  if (rules.conventional && parsed.type === undefined) {
    found.push(`not in the repo's type(scope): summary style`)
  }
  if (rules.conventional && parsed.type !== undefined && rules.types.length && !rules.types.includes(parsed.type)) {
    found.push(`type "${parsed.type}" is not used in this repo (${rules.types.join(", ")})`)
  }
  if (rules.conventional && parsed.scope !== undefined && rules.scopes.length && !rules.scopes.includes(parsed.scope)) {
    found.push(`scope "${parsed.scope}" is not used in this repo (${rules.scopes.join(", ")})`)
  }
  if (line.length > rules.length) {
    found.push(`subject is ${line.length} characters; this repo stays under ${rules.length}`)
  }
  if (!rules.period && line.endsWith(".")) {
    found.push("subject ends with a period; this repo's subjects do not")
  }
  if (rules.lower && parsed.summary && parsed.summary[0] !== parsed.summary[0].toLowerCase()) {
    found.push("summary starts uppercase; this repo starts summaries lowercase")
  }
  return found
}

export default Runtime.handler(Commands.commands.commitlint, (input) =>
  Effect.gen(function* () {
    if (input.history < 10) return yield* Effect.fail(new Error("--history must be at least 10"))
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const cwd = root.stdout.toString().trim()
    const base = yield* git.defaultBranch(cwd)
    const range = yield* Effect.gen(function* () {
      if (Option.isSome(input.range) && input.range.value) return input.range.value
      if (!base)
        return yield* Effect.fail(new Error("Could not determine the default branch. Pass a range with --range."))
      const merged = yield* git.run(["merge-base", base, "HEAD"], cwd)
      const merge = merged.exitCode === 0 ? merged.stdout.toString().trim() : undefined
      if (!merge) return yield* Effect.fail(new Error(`Could not find a merge base with ${base}.`))
      return `${merge}..HEAD`
    })

    const sampled = yield* git.run(
      ["log", "--no-merges", `--format=%s`, "-n", String(input.history), base ?? "HEAD"],
      cwd,
    )
    if (sampled.exitCode !== 0)
      return yield* Effect.fail(new Error(sampled.stderr.toString().trim() || "git log failed"))
    const history = sampled.stdout
      .toString()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    if (history.length < 10) {
      return yield* Effect.fail(new Error("Not enough history to learn conventions from. Need at least 10 commits."))
    }
    const rules = convention(history)

    const listed = yield* git.run(["log", "--no-merges", "--format=%h%x00%s", range], cwd)
    if (listed.exitCode !== 0) return yield* Effect.fail(new Error(listed.stderr.toString().trim() || "git log failed"))
    const commits = listed.stdout
      .toString()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split("\x00"))
      .map((parts) => ({ sha: parts[0], subject: parts[1] ?? "" }))
    if (!commits.length) {
      println(`No commits in ${range}. Nothing to lint.`)
      return
    }

    println(
      `Learned from ${history.length} commits: ${rules.conventional ? `type(scope): summary style, types [${rules.types.join(", ")}]` : "freeform subjects"}, max ${rules.length} chars.`,
    )
    println()

    const dirty = commits
      .map((commit) => ({ commit, issues: lint(commit.subject, rules) }))
      .filter((entry) => entry.issues.length)
    for (const entry of dirty) {
      println(`${entry.commit.sha} ${entry.commit.subject}`)
      for (const issue of entry.issues) println(`  - ${issue}`)
    }

    if (!dirty.length) {
      println(`All ${commits.length} commit messages match the repo's conventions.`)
      return
    }
    println()
    println(`${dirty.length} of ${commits.length} commit messages break the repo's conventions.`)
    process.exitCode = 1
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
