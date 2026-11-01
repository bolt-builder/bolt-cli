import { Effect } from "effect"
import { ChildProcess } from "effect/process"
import { AppProcess } from "@opencode/util/process"

/** Local Git operations shared by repository-only CLI commands. */
export const make = Effect.gen(function* () {
  const processService = yield* AppProcess.Service
  const run = (args: string[], cwd = process.cwd()) =>
    processService.run(
      ChildProcess.make(
        "git",
        [
          "--no-optional-locks",
          "-c",
          "core.autocrlf=false",
          "-c",
          "core.fsmonitor=false",
          "-c",
          "core.longpaths=true",
          "-c",
          "core.symlinks=true",
          "-c",
          "core.quotepath=false",
          ...args,
        ],
        { cwd },
      ),
    )
  const defaultBranch = Effect.fn("cli.Git.defaultBranch")(function* (cwd: string) {
    const remotes = (yield* run(["remote"], cwd)).stdout.toString().trim().split(/\r?\n/).filter(Boolean)
    const remote = remotes.includes("origin")
      ? "origin"
      : remotes.length === 1
        ? remotes[0]
        : remotes.includes("upstream")
          ? "upstream"
          : remotes[0]
    if (remote) {
      const head = yield* run(["symbolic-ref", `refs/remotes/${remote}/HEAD`], cwd)
      if (head.exitCode === 0) {
        const ref = head.stdout
          .toString()
          .trim()
          .replace(/^refs\/remotes\//, "")
        if (ref.startsWith(`${remote}/`) && ref.length > remote.length + 1) return ref
      }
    }
    const branches = (yield* run(["for-each-ref", "--format=%(refname:short)", "refs/heads"], cwd)).stdout
      .toString()
      .trim()
      .split(/\r?\n/)
    const configured = (yield* run(["config", "init.defaultBranch"], cwd)).stdout.toString().trim()
    if (configured && branches.includes(configured)) return configured
    if (branches.includes("main")) return "main"
    if (branches.includes("master")) return "master"
  })
  return { run, defaultBranch }
})

export * as Git from "./git"
