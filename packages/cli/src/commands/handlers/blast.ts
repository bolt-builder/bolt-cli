import { Effect, Option } from "effect"
import { ChildProcess } from "effect/process"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Blast } from "../../services/blast"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"

const println = (text = "") => process.stdout.write(text + "\n")

const handler = Effect.fn("cli.blast")(function* (input: Runtime.Input<typeof Commands.commands.blast>) {
  if (input.staged && Option.isSome(input.branch)) {
    return yield* Effect.fail(new Error("--staged and --branch cannot be used together"))
  }
  const processService = yield* AppProcess.Service
  const run = (args: string[], options: { cwd: string }) =>
    processService.run(ChildProcess.make("git", args, { ...options, stdin: "ignore" }))
  const root = yield* run(["rev-parse", "--show-toplevel"], { cwd: process.cwd() }).pipe(
    Effect.flatMap(AppProcess.requireSuccess),
  )
  const cwd = root.stdout.toString().trim()
  const range = yield* Effect.gen(function* () {
    if (input.staged) return ["diff", "--cached"]
    if (Option.isNone(input.branch)) {
      const head = yield* run(["rev-parse", "--verify", "HEAD"], { cwd })
      if (head.exitCode === 0) return ["diff", "HEAD"]
      const empty = yield* run(["hash-object", "-t", "tree", "--stdin"], { cwd }).pipe(
        Effect.flatMap(AppProcess.requireSuccess),
      )
      return ["diff", empty.stdout.toString().trim()]
    }
    const merge = yield* run(["merge-base", "HEAD", input.branch.value], { cwd }).pipe(
      Effect.flatMap(AppProcess.requireSuccess),
    )
    return ["diff", `${merge.stdout.toString().trim()}..HEAD`]
  })
  const numstat = yield* run([...range, "--numstat", "-z"], { cwd })
  if (numstat.exitCode !== 0)
    return yield* Effect.fail(new Error(numstat.stderr.toString().trim() || "git diff failed"))
  const changes = Blast.parse(numstat.stdout.toString())
  if (changes.length === 0) {
    println("No tracked changes to analyze.")
    return
  }

  const additions = changes.reduce((sum, item) => sum + item.additions, 0)
  const deletions = changes.reduce((sum, item) => sum + item.deletions, 0)
  const packages = [...new Set(changes.map((item) => Blast.pkg(item.path)))].sort()
  const counts = { source: 0, test: 0, docs: 0, config: 0 }
  for (const change of changes) counts[Blast.kind(change.path)] += 1

  // Estimate dependents per changed source file by grepping for import specifiers
  // ending in the file's stem, e.g. `/undo"` matches `from "@/cli/cmd/undo"`.
  const sources = changes.filter((item) => Blast.kind(item.path) === "source").slice(0, 25)
  const dependents = yield* Effect.forEach(
    sources,
    (change) =>
      Effect.gen(function* () {
        const result = yield* run(
          [
            "grep",
            "-l",
            "-F",
            ...['"', "'"].flatMap((quote) =>
              ["", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"].flatMap((extension) => [
                "-e",
                `/${Blast.stem(change.path)}${extension}${quote}`,
              ]),
            ),
            "--",
            "*.ts",
            "*.tsx",
            "*.js",
            "*.jsx",
            "*.mjs",
            "*.cjs",
          ],
          {
            cwd,
          },
        )
        if (result.exitCode !== 0) return { path: change.path, count: 0 }
        const files = result.stdout
          .toString()
          .split("\n")
          .filter((line) => line.length > 0 && line !== change.path)
        return { path: change.path, count: files.length }
      }),
    { concurrency: 4 },
  )

  const grade = Blast.risk({
    source: counts.source,
    tests: counts.test,
    packages: packages.length,
    dependents: Math.max(0, ...dependents.map((item) => item.count)),
  })

  println()
  println(`Blast radius (${input.staged ? "staged" : Option.isSome(input.branch) ? "branch" : "working tree"}):`)
  println()
  println(
    `  ${changes.length} file${changes.length === 1 ? "" : "s"} changed (+${additions}/-${deletions}) across ${packages.length} package${packages.length === 1 ? "" : "s"}: ${packages.join(", ")}`,
  )
  println(`  source: ${counts.source}, test: ${counts.test}, docs: ${counts.docs}, config: ${counts.config}`)
  const top = dependents
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  if (top.length > 0) {
    println()
    println("  most-referenced changed files:")
    for (const item of top) {
      println(`    ${item.path} — referenced by ~${item.count} file${item.count === 1 ? "" : "s"}`)
    }
  }
  println()
  println(`  risk: ${grade}`)
  println()
})

export default Runtime.handler(Commands.commands.blast, (input) =>
  handler(input).pipe(Effect.provide(LayerNode.compile(AppProcess.node))),
)
