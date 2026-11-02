import path from "node:path"
import os from "node:os"
import { Effect, Exit } from "effect"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Git } from "../../services/git"
import { errorMessage } from "../../util/error"

/** Interpret `git cherry <target> <sha> <sha>~1` output for a single commit. */
export function ported(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) return "present"
  if (lines.every((line) => line.startsWith("-"))) return "present"
  if (lines.every((line) => line.startsWith("+") || line.startsWith("-"))) return "absent"
  return undefined
}

/** Slugify a ref for use inside a branch name. */
export function slug(ref: string) {
  return ref
    .toLowerCase()
    .replace(/^origin\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
}

/** Branch name for a ported commit. */
export function name(sha: string, target: string) {
  return `port-${sha.slice(0, 7)}-${slug(target)}`
}

/** Parse unmerged paths out of `git status --porcelain=v1` output. */
export function conflicts(text: string) {
  const codes = ["DD", "AU", "UD", "UA", "DU", "AA", "UU"]
  return text
    .split("\n")
    .filter((line) => codes.includes(line.slice(0, 2)))
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
}

export default Runtime.handler(Commands.commands.port, (input) =>
  Effect.gen(function* () {
    if (!input.to.length) return yield* Effect.fail(new Error("Pass at least one target branch with --to <branch>."))
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"])
    if (root.exitCode !== 0)
      return yield* Effect.fail(
        new Error("Could not find git repository. Please run this command from a git repository."),
      )
    const cwd = root.stdout.toString().trim()
    const resolved = yield* git.run(["rev-parse", "--verify", "--end-of-options", `${input.commit}^{commit}`], cwd)
    if (resolved.exitCode !== 0) return yield* Effect.fail(new Error(`Could not resolve ${input.commit} to a commit.`))
    const sha = resolved.stdout.toString().trim()
    const subject = yield* git.run(["log", "-1", "--format=%s", sha], cwd)
    process.stdout.write(`Porting ${sha.slice(0, 7)} ${subject.stdout.toString().trim()}\n`)
    const ancestry = yield* git
      .run(["rev-list", "--parents", "-n", "1", sha], cwd)
      .pipe(Effect.flatMap(AppProcess.requireSuccess))
    const parent = ancestry.stdout.toString().trim().split(/\s+/)[1]
    const states = yield* Effect.forEach([...new Set(input.to)], (target) =>
      Effect.gen(function* () {
        const exists = yield* git.run(["rev-parse", "--verify", "--end-of-options", `${target}^{commit}`], cwd)
        if (exists.exitCode !== 0) return { target, sha: "", state: "unknown" }
        const targetSHA = exists.stdout.toString().trim()
        const cherry = yield* git.run(["cherry", targetSHA, sha, ...(parent ? [parent] : [])], cwd)
        return {
          target,
          sha: targetSHA,
          state: cherry.exitCode === 0 ? (ported(cherry.stdout.toString()) ?? "unknown") : "unknown",
        }
      }),
    )
    const bad = states.filter((entry) => entry.state === "unknown")
    if (bad.length)
      return yield* Effect.fail(new Error(`Could not inspect: ${bad.map((entry) => entry.target).join(", ")}`))
    for (const entry of states)
      process.stdout.write(
        `  ${entry.target}: ${entry.state === "present" ? "already has an equivalent change, skipping" : `needs the fix -> ${name(sha, entry.target)}`}\n`,
      )
    const pending = states.filter((entry) => entry.state === "absent")
    if (!pending.length) {
      process.stdout.write("Every target already has the fix. Nothing to do.\n")
      return
    }
    if (!input.apply) {
      process.stdout.write("Dry run. Rerun with --apply to create the port branches. Nothing is ever force-pushed.\n")
      return
    }
    const failures: string[] = []
    for (const entry of pending) {
      yield* Effect.scoped(
        Effect.gen(function* () {
          const branch = name(sha, entry.target)
          if ((yield* git.run(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], cwd)).exitCode === 0)
            return yield* Effect.fail(new Error(`${entry.target}: branch ${branch} already exists`))
          const directory = path.join(os.tmpdir(), `bolt-port-${crypto.randomUUID()}`)
          yield* Effect.acquireRelease(
            git
              .run(["worktree", "add", "--detach", directory, entry.sha], cwd)
              .pipe(Effect.flatMap(AppProcess.requireSuccess)),
            () =>
              git.run(["worktree", "remove", "--force", directory], cwd).pipe(
                Effect.exit,
                Effect.flatMap((removed) =>
                  Effect.sync(() => {
                    if (Exit.isSuccess(removed) && removed.value.exitCode === 0) return
                    failures.push(`${entry.target}: failed to remove temporary worktree ${directory}`)
                  }),
                ),
              ),
          )
          const picked = yield* git.run(["cherry-pick", "-x", sha], directory)
          if (picked.exitCode !== 0) {
            const status = yield* git.run(["status", "--porcelain=v1"], directory)
            yield* git.run(["cherry-pick", "--abort"], directory)
            return yield* Effect.fail(
              new Error(
                `${entry.target}: cherry-pick conflicts in ${conflicts(status.stdout.toString()).join(", ") || "unknown files"}. Check out ${entry.target}, cherry-pick ${sha.slice(0, 7)} yourself, and use bolt resolve.`,
              ),
            )
          }
          yield* git.run(["branch", branch, "HEAD"], directory).pipe(Effect.flatMap(AppProcess.requireSuccess))
          process.stdout.write(`Ported onto ${branch}\n`)
          if (!input.push) return
          yield* git.run(["push", "-u", "origin", branch], cwd).pipe(Effect.flatMap(AppProcess.requireSuccess))
          process.stdout.write(`Pushed ${branch}\n`)
        }).pipe(
          Effect.catch((error) =>
            Effect.sync(() => {
              failures.push(errorMessage(error))
            }),
          ),
        ),
      )
    }
    if (failures.length) return yield* Effect.fail(new Error(failures.join("\n")))
    process.stdout.write("All ports complete. Open pull requests from the port branches into their targets.\n")
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
