import fs from "node:fs"
import path from "node:path"
import { Effect } from "effect"
import { isRecord } from "@opencode/util/record"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { ChildProcess } from "effect/process"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { names, document } from "./shared"

export type Change = { path: string; kind: "added" | "removed" | "changed"; before?: unknown; after?: unknown }

// Flatten a parsed config into leaf paths; arrays and empty objects count as leaf values.
function flatten(value: unknown, prefix: string[] = []): Map<string, unknown> {
  if (!isRecord(value) || !Object.keys(value).length) {
    return new Map(prefix.length ? [[prefix.join("."), value]] : [])
  }
  return new Map(Object.entries(value).flatMap(([key, child]) => [...flatten(child, [...prefix, key])]))
}

/** Per-key differences between a committed config object and the local one. */
export function changes(base: unknown, next: unknown): Change[] {
  const left = flatten(base)
  const right = flatten(next)
  const paths = Array.from(new Set([...left.keys(), ...right.keys()])).sort()
  return paths.flatMap((item): Change[] => {
    const has = { left: left.has(item), right: right.has(item) }
    if (!has.left) return [{ path: item, kind: "added", after: right.get(item) }]
    if (!has.right) return [{ path: item, kind: "removed", before: left.get(item) }]
    if (JSON.stringify(left.get(item)) === JSON.stringify(right.get(item))) return []
    return [{ path: item, kind: "changed", before: left.get(item), after: right.get(item) }]
  })
}

/** Render one change as a diff-style line. */
export function line(change: Change) {
  if (change.kind === "added") return `  + ${change.path} = ${JSON.stringify(change.after)}`
  if (change.kind === "removed") return `  - ${change.path} (was ${JSON.stringify(change.before)})`
  return `  ~ ${change.path}: ${JSON.stringify(change.before)} -> ${JSON.stringify(change.after)}`
}

export default Runtime.handler(Commands.commands.config.commands.diff, (input) =>
  Effect.gen(function* () {
    const app = yield* AppProcess.Service
    const git = (args: string[], cwd = process.cwd()) =>
      app
        .run(ChildProcess.make("git", ["--no-optional-locks", ...args], { cwd }), {
          maxOutputBytes: 1_000_000,
          maxErrorBytes: 10_000,
        })
        .pipe(
          Effect.flatMap((result) =>
            result.stdoutTruncated
              ? Effect.fail(new Error("Configuration diff exceeds the output limit"))
              : Effect.succeed(result),
          ),
        )
    const root = yield* git(["rev-parse", "--show-toplevel"]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const cwd =
      process.platform === "win32"
        ? fs.realpathSync.native(root.stdout.toString().trim())
        : root.stdout.toString().trim()
    const tracked = yield* git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd).pipe(
      Effect.flatMap(AppProcess.requireSuccess),
    )
    const directories = new Set<string>()
    for (
      let directory = process.platform === "win32" ? fs.realpathSync.native(process.cwd()) : process.cwd();
      ;
      directory = path.dirname(directory)
    ) {
      for (const child of [directory, path.join(directory, ".bolt"), path.join(directory, ".opencode")])
        directories.add(path.relative(cwd, child).replaceAll("\\", "/"))
      if (directory === cwd || path.dirname(directory) === directory) break
    }
    const candidates = [
      ...new Set(
        tracked.stdout
          .toString()
          .split("\0")
          .filter(
            (file) =>
              names.includes(path.posix.basename(file)) &&
              directories.has(path.posix.dirname(file) === "." ? "" : path.posix.dirname(file)),
          ),
      ),
    ].sort()
    let findings = 0
    for (const relative of candidates) {
      const committed = yield* git(["show", `HEAD:${relative}`], cwd)
      const before = committed.exitCode === 0 ? committed.stdout.toString() : ""
      const file = path.join(cwd, relative)
      if (Bun.file(file).size > 1_000_000)
        return yield* Effect.fail(new Error(`Configuration file is too large: ${relative}`))
      const after = (yield* Effect.promise(() => Bun.file(file).exists()))
        ? yield* Effect.promise(() => Bun.file(file).text())
        : ""
      if (before === after) continue
      findings++
      if (input.patch) {
        const { createTwoFilesPatch } = yield* Effect.promise(() => import("diff"))
        process.stdout.write(createTwoFilesPatch(`${relative} (HEAD)`, relative, before, after).trimEnd() + "\n")
        continue
      }
      process.stdout.write(`${relative}${!before ? " (not committed)" : !after ? " (deleted locally)" : ""}\n`)
      const list = changes(before ? document(before, relative + "@HEAD") : {}, after ? document(after, relative) : {})
      if (!list.length) process.stdout.write("  (only comments or formatting changed)\n")
      for (const change of list) process.stdout.write(line(change) + "\n")
    }
    if (!findings) process.stdout.write("No differences between local config and the committed project config.\n")
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))),
)
