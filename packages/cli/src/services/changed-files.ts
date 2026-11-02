import { Effect, Option } from "effect"
import path from "node:path"
import { AppProcess } from "@opencode/util/process"
import { Git } from "./git"

/** Resolve explicit paths or the original V1 working-tree/merge-base selection. */
export const changedFiles = Effect.fn("cli.changedFiles")(function* (
  files: readonly string[],
  branch: Option.Option<string>,
) {
  if (Option.isSome(branch) && !branch.value && files.length) {
    const index = process.argv.indexOf("--branch", 2)
    const value = index >= 0 ? process.argv[index + 1] : undefined
    if (value && !value.startsWith("-")) {
      const position = files.lastIndexOf(value)
      if (position >= 0) {
        branch = Option.some(value)
        files = files.filter((_, at) => at !== position)
      }
    }
  }
  const git = yield* Git.make
  const root = yield* git.run(["rev-parse", "--show-toplevel"])
  const cwd = root.exitCode === 0 ? root.stdout.toString().trim() : process.cwd()
  if (files.length) return { cwd, files: files.map((file) => path.relative(cwd, path.resolve(file))) }
  if (root.exitCode !== 0)
    return yield* Effect.fail(new Error("Not a git repository. Pass the files to scan explicitly."))
  const range = yield* Effect.gen(function* () {
    if (Option.isNone(branch)) return ["diff", "--name-only", "-z", "HEAD"]
    const base = branch.value || (yield* git.defaultBranch(cwd))
    if (!base)
      return yield* Effect.fail(new Error("Could not determine the default branch. Pass one with --branch <name>."))
    const merge = yield* git.run(["merge-base", base, "HEAD"], cwd)
    if (merge.exitCode !== 0) return yield* Effect.fail(new Error(`Could not find a merge base with ${base}.`))
    return ["diff", "--name-only", "-z", `${merge.stdout.toString().trim()}..HEAD`]
  })
  const result = yield* git.run(range, cwd).pipe(Effect.flatMap(AppProcess.requireSuccess))
  return { cwd, files: result.stdout.toString().split("\0").filter(Boolean) }
})
