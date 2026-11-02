import os from "node:os"
import path from "node:path"
import { Effect, Exit, Option } from "effect"
import { ChildProcess } from "effect/process"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Git } from "../../services/git"
import { errorMessage } from "../../util/error"
const println = (text = "") => process.stdout.write(text + "\n")
const fail = (text: string) => Effect.fail(new Error(text))
/** Summarize a series of duration samples in milliseconds. */
export function stats(samples: number[]) {
  const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length
  const variance = samples.reduce((sum, sample) => sum + (sample - mean) ** 2, 0) / samples.length
  return {
    mean,
    stddev: Math.sqrt(variance),
    min: Math.min(...samples),
    max: Math.max(...samples),
  }
}

/** Compare base and head mean durations against a percentage threshold. */
export function compare(base: number, head: number, threshold: number) {
  const ratio = head / base
  if (ratio > 1 + threshold / 100) return { ratio, verdict: "regression" as const }
  if (ratio < 1 - threshold / 100) return { ratio, verdict: "improvement" as const }
  return { ratio, verdict: "neutral" as const }
}

/** Validate and normalize the numeric bench options. Returns an error message string for invalid input. */
export function normalize(options: { runs: number; warmup: number; threshold: number }) {
  if (!Number.isFinite(options.runs) || !Number.isFinite(options.warmup))
    return "--runs and --warmup must be finite numbers."
  if (!Number.isFinite(options.threshold) || options.threshold < 0)
    return "--threshold must be a finite, non-negative percentage."
  return {
    runs: Math.max(1, Math.floor(options.runs)),
    warmup: Math.max(0, Math.floor(options.warmup)),
    threshold: options.threshold,
  }
}

/** Render a stats line like "mean 124.3ms (stddev 3.1ms, min 120.9ms, max 129.0ms)". */
export function render(summary: ReturnType<typeof stats>) {
  const ms = (value: number) => `${value.toFixed(1)}ms`
  return `mean ${ms(summary.mean)} (stddev ${ms(summary.stddev)}, min ${ms(summary.min)}, max ${ms(summary.max)})`
}

export default Runtime.handler(Commands.commands.bench, (args) =>
  Effect.gen(function* () {
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"])
    if (root.exitCode !== 0)
      return yield* fail("Could not find git repository. Please run this command from a git repository.")
    const cwd = root.stdout.toString().trim()
    const command = args.command
    const options = normalize(args)
    if (typeof options === "string") return yield* fail(options)
    const runs = options.runs
    const warmup = options.warmup

    const base = yield* Effect.gen(function* () {
      if (Option.isSome(args.base)) return args.base.value
      const branch = yield* git.defaultBranch(cwd)
      if (!branch) return yield* fail("Could not determine the default branch. Pass a ref with --base.")
      const merge = yield* git.run(["merge-base", branch, "HEAD"], cwd)
      if (merge.exitCode !== 0)
        return yield* fail(`Could not find a merge base with ${branch}. Pass a ref with --base.`)
      return merge.stdout.toString().trim()
    })

    const measure = (dir: string, label: string) =>
      Effect.gen(function* () {
        const processService = yield* AppProcess.Service
        const execute = Effect.gen(function* () {
          const started = performance.now()
          const proc = yield* processService.run(
            ChildProcess.make(command, { shell: true, cwd: dir, stdout: "ignore", stderr: "ignore" }),
          )
          return { code: proc.exitCode, elapsed: performance.now() - started }
        })
        for (let index = 0; index < warmup; index++) {
          const run = yield* execute
          if (run.code !== 0) return yield* fail(`The command failed on ${label} (exit ${run.code}).`)
        }
        const samples: number[] = []
        for (let index = 0; index < runs; index++) {
          const run = yield* execute
          if (run.code !== 0) return yield* fail(`The command failed on ${label} (exit ${run.code}).`)
          samples.push(run.elapsed)
          println(`  ${label} run ${index + 1}/${runs}: ${run.elapsed.toFixed(1)}ms`)
        }
        return samples
      })

    const worktree = path.join(os.tmpdir(), `bolt-bench-${process.pid}-${Date.now()}`)
    println(`Checking out base ${base.slice(0, 12)} into a temporary worktree...`)
    yield* Effect.acquireRelease(
      git.run(["worktree", "add", "--detach", worktree, base], cwd).pipe(Effect.flatMap(AppProcess.requireSuccess)),
      () =>
        git.run(["worktree", "remove", "--force", worktree], cwd).pipe(
          Effect.exit,
          Effect.flatMap((removed) =>
            Exit.isSuccess(removed) && removed.value.exitCode === 0
              ? Effect.void
              : Effect.sync(() => {
                  process.exitCode ||= 1
                  process.stderr.write(
                    `Failed to remove the temporary worktree. Run "git worktree remove --force ${worktree}" to clean up.\n`,
                  )
                }),
          ),
        ),
    )

    const result = yield* Effect.gen(function* () {
      println(`Timing "${command}" on base (${warmup} warmup, ${runs} timed)...`)
      const before = yield* measure(worktree, "base")
      println(`Timing "${command}" on this change (${warmup} warmup, ${runs} timed)...`)
      const after = yield* measure(cwd, "head")
      return { before, after }
    })

    const baseline = stats(result.before)
    const current = stats(result.after)
    const outcome = compare(baseline.mean, current.mean, args.threshold)

    println()
    println(`Base: ${render(baseline)}`)
    println(`Head: ${render(current)}`)
    println(`Head/base ratio: ${outcome.ratio.toFixed(3)} (threshold ${args.threshold}%)`)
    if (outcome.verdict === "regression") {
      println(`Verdict: REGRESSION. Head is ${((outcome.ratio - 1) * 100).toFixed(1)}% slower than base.`)
      process.exitCode = 1
      return
    }
    if (outcome.verdict === "improvement") {
      println(`Verdict: improvement. Head is ${((1 - outcome.ratio) * 100).toFixed(1)}% faster than base.`)
      return
    }
    println("Verdict: neutral. No change beyond the threshold.")
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
