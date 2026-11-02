import path from "node:path"
import { Effect, Option, Schema } from "effect"
import { ChildProcess } from "effect/process"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Git } from "../../services/git"
import { errorMessage } from "../../util/error"
const println = (text = "") => process.stdout.write(text + "\n")
const fail = (text: string) => Effect.fail(new Error(text))
const OUTPUT_LIMIT = 8_000
const SYMBOL_LIMIT = 50
const CODE = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"]

/** Extract exported symbol names and their lines from a source file. */
export function exported(source: string) {
  const declarations = [
    /^export (?:async )?function\*? (\w+)/,
    /^export (?:const|let|var) (\w+)/,
    /^export (?:abstract )?class (\w+)/,
    /^export (?:type|interface|enum) (\w+)/,
    /^export \* as (\w+)/,
  ]
  return source.split("\n").flatMap((text, index) => {
    const line = text.trim()
    const single = declarations.flatMap((declaration) => {
      const match = line.match(declaration)
      if (!match) return []
      return [{ name: match[1], line: index + 1 }]
    })
    if (single.length > 0) return single
    const list = line.match(/^export \{ ([^}]+) \}/)
    if (!list) return []
    return list[1]
      .split(",")
      .map(
        (entry) =>
          entry
            .trim()
            .split(/\s+as\s+/)
            .at(-1) ?? "",
      )
      .filter((name) => /^\w+$/.test(name) && name !== "default")
      .map((name) => ({ name, line: index + 1 }))
  })
}

/** True when every reference to a symbol lives in its defining file. */
export function dead(file: string, paths: string[]) {
  const source = file.replaceAll("\\", "/")
  return paths.every((reference) => reference.replaceAll("\\", "/") === source)
}

export default Runtime.handler(Commands.commands.analyze, (args) =>
  Effect.gen(function* () {
    if (Option.isSome(args.branchTarget) && (Option.isNone(args.branch) || args.branch.value))
      return yield* fail(`Unexpected argument: ${args.branchTarget.value}`)
    const branch = Option.isSome(args.branchTarget) ? args.branchTarget : args.branch
    if (args.staged && Option.isSome(branch)) return yield* fail("--staged and --branch cannot be used together")
    const processService = yield* AppProcess.Service
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"])
    if (root.exitCode !== 0)
      return yield* fail("Could not find git repository. Please run this command from a git repository.")
    const cwd = root.stdout.toString().trim()
    const range = yield* Effect.gen(function* () {
      if (args.staged) return ["diff", "--cached"]
      if (Option.isNone(branch)) return ["diff", "HEAD"]
      const base = yield* Effect.gen(function* () {
        if (Option.isSome(branch) && branch.value) return branch.value
        const defaultBranch = yield* git.defaultBranch(cwd)
        if (!defaultBranch) return yield* fail("Could not determine the default branch. Pass one with --branch <name>.")
        return defaultBranch
      })
      const merge = yield* git.run(["merge-base", base, "HEAD"], cwd)
      if (merge.exitCode !== 0) return yield* fail(`Could not find a merge base with ${base}.`)
      return ["diff", `${merge.stdout.toString().trim()}..HEAD`]
    })

    // Name-only output lists deletions and pure renames, which carry no `+++` header in a unified diff.
    const diff = yield* git.run([...range, "--name-only", "-z"], cwd)
    if (diff.exitCode !== 0) return yield* fail(diff.stderr.toString().trim() || "git diff failed")
    const files = [...new Set(diff.stdout.toString().split("\0").filter(Boolean))]
    if (files.length === 0) {
      println("Nothing to analyze.")
      return
    }
    println(`Analyzing ${files.length} changed file${files.length === 1 ? "" : "s"}...`)

    // Lint and typecheck run through the project's own scripts so the pass
    // reflects exactly what the repo enforces.
    const manifest = path.join(cwd, "package.json")
    const pkg = yield* Effect.tryPromise(() => Bun.file(manifest).json()).pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(
          Schema.Struct({ scripts: Schema.optional(Schema.Record(Schema.String, Schema.String)) }),
        ),
      ),
      Effect.option,
    )
    const runner = yield* Effect.promise(async () => {
      if (await Bun.file(path.join(cwd, "bun.lock")).exists()) return "bun run"
      if (await Bun.file(path.join(cwd, "bun.lockb")).exists()) return "bun run"
      if (await Bun.file(path.join(cwd, "pnpm-lock.yaml")).exists()) return "pnpm run"
      if (await Bun.file(path.join(cwd, "yarn.lock")).exists()) return "yarn"
      return "npm run"
    })

    let failed = false
    for (const script of ["lint", "typecheck"]) {
      if (Option.isNone(pkg) || !pkg.value.scripts?.[script]) {
        println(`  ${script}: no "${script}" script in package.json, skipped`)
        continue
      }
      const command = `${runner} ${script}`
      const result = yield* processService.run(
        ChildProcess.make(command, { shell: true, cwd, stdout: "pipe", stderr: "pipe" }),
      )
      const run = {
        code: result.exitCode,
        output: [result.stdout.toString().trim(), result.stderr.toString().trim()].filter(Boolean).join("\n"),
      }
      if (run.code === 0) {
        println(`  ${script}: pass`)
        continue
      }
      failed = true
      println(`  ${script}: FAIL (exit ${run.code})`)
      println(run.output.slice(-OUTPUT_LIMIT))
    }

    const sources = files.filter((file) => CODE.includes(path.extname(file)))
    const suspects: { file: string; name: string; line: number }[] = []
    let scanned = 0
    for (const file of sources) {
      const target = path.resolve(cwd, file)
      const exists = yield* Effect.promise(() => Bun.file(target).exists())
      if (!exists) continue
      const source = yield* Effect.promise(() => Bun.file(target).text())
      for (const symbol of exported(source)) {
        if (scanned >= SYMBOL_LIMIT) break
        scanned++
        const matches = yield* git.run(
          [
            "grep",
            "-l",
            "-z",
            "-I",
            "-w",
            "--untracked",
            "--exclude-standard",
            "-e",
            symbol.name,
            "--",
            ...CODE.map((extension) => `*${extension}`),
          ],
          cwd,
        )
        if (matches.exitCode !== 0 && matches.exitCode !== 1)
          return yield* fail(matches.stderr.toString().trim() || "git grep failed")
        if (dead(file, matches.stdout.toString().split("\0").filter(Boolean))) {
          suspects.push({ file, name: symbol.name, line: symbol.line })
        }
      }
    }

    println()
    if (suspects.length > 0) {
      println("Possibly dead exports (referenced nowhere outside their own file):")
      for (const suspect of suspects) println(`  ${suspect.file}:${suspect.line} ${suspect.name}`)
      println()
    }
    if (scanned >= SYMBOL_LIMIT) println(`Dead-code scan capped at ${SYMBOL_LIMIT} symbols.`)

    if (failed) {
      println("Verdict: FAIL. Fix lint or typecheck before handing off this diff.")
      process.exitCode = 1
      return
    }
    println(
      suspects.length > 0
        ? "Verdict: pass with warnings. Review the possibly dead exports before handoff."
        : "Verdict: pass. The diff is clean.",
    )
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
