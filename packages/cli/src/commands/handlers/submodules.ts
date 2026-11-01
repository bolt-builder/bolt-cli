import { Effect } from "effect"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Git } from "../../services/git"
import { errorMessage } from "../../util/error"
const println = (text = "") => process.stdout.write(text + "\n")
const fail = (text: string) => Effect.fail(new Error(text))
export type Module = {
  readonly name: string
  readonly path: string
  readonly url: string
  readonly branch?: string
}

export type State = {
  readonly path: string
  readonly sha: string
  readonly status: "ok" | "uninitialized" | "drifted" | "conflicted"
}

/** Parse .gitmodules content into declared submodules. */
export function modules(text: string) {
  const found: { name: string; path?: string; url?: string; branch?: string }[] = []
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) continue
    const header = trimmed.match(/^\[submodule\s+"(.+)"\]$/)
    if (header) {
      found.push({ name: header[1] })
      continue
    }
    const entry = trimmed.match(/^(path|url|branch)\s*=\s*(.+)$/)
    if (!entry) continue
    const current = found.at(-1)
    if (!current) continue
    if (entry[1] === "path") current.path = entry[2].trim()
    if (entry[1] === "url") current.url = entry[2].trim()
    if (entry[1] === "branch") current.branch = entry[2].trim()
  }
  return found
    .filter((item): item is { name: string; path: string; url: string; branch?: string } =>
      Boolean(item.path && item.url),
    )
    .map(
      (item) =>
        ({
          name: item.name,
          path: item.path,
          url: item.url,
          ...(item.branch ? { branch: item.branch } : {}),
        }) satisfies Module,
    )
}

/** Parse `git submodule status --recursive` output into per-path states. */
export function states(text: string) {
  return text
    .split("\n")
    .map((line) => line.match(/^([ \-+U])([0-9a-f]{40})\s+(\S+)/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => {
      const flag = match[1]
      const status =
        flag === "-" ? "uninitialized" : flag === "+" ? "drifted" : flag === "U" ? "conflicted" : ("ok" as const)
      return { path: match[3], sha: match[2], status } satisfies State
    })
}

/** Join declared submodules with observed states into report rows. */
export function report(declared: Module[], observed: State[]) {
  const known = observed.map((state) => state.path)
  const missing = declared
    .filter((module) => !known.includes(module.path))
    .map((module) => ({ path: module.path, sha: "", status: "uninitialized" as const }))
  return [...observed, ...missing]
}

export default Runtime.handler(Commands.commands.submodules, (args) =>
  Effect.gen(function* () {
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"])
    if (root.exitCode !== 0)
      return yield* fail("Could not find git repository. Please run this command from a git repository.")
    const cwd = root.stdout.toString().trim()

    const config = yield* Effect.promise(() =>
      Bun.file(`${cwd}/.gitmodules`)
        .text()
        .catch(() => ""),
    )
    const declared = modules(config)
    if (!declared.length) {
      println("This repository declares no submodules.")
      return
    }

    const status = yield* git.run(["submodule", "status", "--recursive"], cwd)
    if (status.exitCode !== 0) return yield* fail(status.stderr.toString().trim() || "git submodule status failed")
    const rows = report(declared, states(status.stdout.toString()))

    println(`${declared.length} declared submodule${declared.length === 1 ? "" : "s"}:`)
    for (const row of rows) {
      const label =
        row.status === "ok"
          ? "in sync"
          : row.status === "uninitialized"
            ? "not initialized"
            : row.status === "drifted"
              ? "checkout differs from the recorded commit"
              : "has merge conflicts"
      println(`  ${row.path}: ${label}${row.sha ? ` (${row.sha.slice(0, 7)})` : ""}`)
    }

    const broken = rows.filter((row) => row.status !== "ok")
    if (!broken.length) {
      println("All submodules are in sync.")
      return
    }
    if (!args.sync) {
      println()
      println(
        `${broken.length} submodule${broken.length === 1 ? " is" : "s are"} out of sync. Rerun with --sync to fix.`,
      )
      process.exitCode = 1
      return
    }

    const conflicted = rows.filter((row) => row.status === "conflicted")
    if (conflicted.length) {
      return yield* fail(
        `Refusing to sync while submodules have merge conflicts: ${conflicted.map((row) => row.path).join(", ")}. Resolve the conflicts first.`,
      )
    }

    println()
    println("Syncing submodule urls...")
    const synced = yield* git.run(["submodule", "sync", "--recursive"], cwd)
    if (synced.exitCode !== 0) return yield* fail(synced.stderr.toString().trim() || "git submodule sync failed")

    println("Updating submodules to their recorded commits...")
    const updated = yield* git.run(["submodule", "update", "--init", "--recursive"], cwd)
    if (updated.exitCode !== 0) return yield* fail(updated.stderr.toString().trim() || "git submodule update failed")

    const after = yield* git.run(["submodule", "status", "--recursive"], cwd)
    if (after.exitCode !== 0) return yield* fail(after.stderr.toString().trim() || "git submodule status failed")
    const left = report(declared, states(after.stdout.toString())).filter((row) => row.status !== "ok")
    if (left.length) {
      return yield* fail(`Still out of sync after update: ${left.map((row) => row.path).join(", ")}`)
    }
    println("All submodules are now in sync.")
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
