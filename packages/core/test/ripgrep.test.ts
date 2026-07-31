import { describe, expect } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Effect } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Ripgrep } from "@opencode-ai/core/ripgrep"
import { RelativePath } from "@opencode-ai/core/schema"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const it = testEffect(LayerNode.compile(Ripgrep.node))

describe("Ripgrep", () => {
  it.live("keeps ignored files out of catch-all find results", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.mkdir(path.join(tmp.path, "node_modules", "pkg"), { recursive: true }))
          yield* Effect.promise(() => fs.mkdir(path.join(tmp.path, "src")))
          yield* Effect.promise(() => Bun.$`git init -q ${tmp.path}`)
          yield* Effect.promise(() => fs.writeFile(path.join(tmp.path, ".gitignore"), "node_modules/\n"))
          yield* Effect.promise(() => fs.writeFile(path.join(tmp.path, "node_modules", "pkg", "index.js"), "ignored\n"))
          yield* Effect.promise(() => fs.writeFile(path.join(tmp.path, "src", "index.js"), "included\n"))

          const files = yield* (yield* Ripgrep.Service).find({ cwd: tmp.path, pattern: "*", limit: 10 })
          expect(files.map((item) => item.path)).toContain(RelativePath.make("src/index.js"))
          expect(files.map((item) => item.path)).not.toContain(RelativePath.make("node_modules/pkg/index.js"))
        }),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("respects .boltignore for find and grep, including from subdirectories", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.mkdir(path.join(tmp.path, "src", "generated"), { recursive: true }))
          yield* Effect.promise(() => Bun.$`git init -q ${tmp.path}`)
          yield* Effect.promise(() => fs.writeFile(path.join(tmp.path, ".boltignore"), "hidden.txt\n/src/generated/\n"))
          yield* Effect.promise(() => fs.writeFile(path.join(tmp.path, "src", "hidden.txt"), "needle\n"))
          yield* Effect.promise(() => fs.writeFile(path.join(tmp.path, "src", "shown.txt"), "needle\n"))
          yield* Effect.promise(() => fs.writeFile(path.join(tmp.path, "src", "generated", "gen.txt"), "needle\n"))
          const ripgrep = yield* Ripgrep.Service

          const files = yield* ripgrep.find({ cwd: tmp.path, pattern: "*", limit: 10 })
          expect(files.map((item) => item.path)).toContain(RelativePath.make("src/shown.txt"))
          expect(files.map((item) => item.path)).not.toContain(RelativePath.make("src/hidden.txt"))
          expect(files.map((item) => item.path)).not.toContain(RelativePath.make("src/generated/gen.txt"))

          const matches = yield* ripgrep.grep({ cwd: tmp.path, pattern: "needle", limit: 10 })
          expect(matches.map((item) => item.entry.path)).toContain(RelativePath.make("src/shown.txt"))
          expect(matches.map((item) => item.entry.path)).not.toContain(RelativePath.make("src/hidden.txt"))

          // Root-anchored rules keep their repository-root scope even when the
          // search starts in a subdirectory.
          const nested = yield* ripgrep.find({ cwd: path.join(tmp.path, "src"), pattern: "*", limit: 10 })
          expect(nested.map((item) => item.path)).toContain(RelativePath.make("shown.txt"))
          expect(nested.map((item) => item.path)).not.toContain(RelativePath.make("hidden.txt"))
          expect(nested.map((item) => item.path)).not.toContain(RelativePath.make("generated/gen.txt"))

          const nestedMatches = yield* ripgrep.grep({ cwd: path.join(tmp.path, "src"), pattern: "needle", limit: 10 })
          expect(nestedMatches.map((item) => item.entry.path)).toContain(RelativePath.make("shown.txt"))
          expect(nestedMatches.map((item) => item.entry.path)).not.toContain(RelativePath.make("hidden.txt"))
          expect(nestedMatches.map((item) => item.entry.path)).not.toContain(RelativePath.make("generated/gen.txt"))
        }),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("ignored reports whether a .boltignore governs a directory", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.mkdir(path.join(tmp.path, "src"), { recursive: true }))
          yield* Effect.promise(() => Bun.$`git init -q ${tmp.path}`)
          expect(Ripgrep.ignored(tmp.path)).toBe(false)
          expect(Ripgrep.ignored(path.join(tmp.path, "src"))).toBe(false)
          yield* Effect.promise(() => fs.writeFile(path.join(tmp.path, ".boltignore"), "hidden.txt\n"))
          expect(Ripgrep.ignored(tmp.path)).toBe(true)
          // Subdirectories resolve the .boltignore at the repository root.
          expect(Ripgrep.ignored(path.join(tmp.path, "src"))).toBe(true)
        }),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("never includes git metadata", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => fs.mkdir(path.join(tmp.path, ".opencode")))
          yield* Effect.promise(() => fs.writeFile(path.join(tmp.path, ".opencode", "config"), "needle\n"))
          yield* Effect.promise(() => fs.mkdir(path.join(tmp.path, ".git")))
          yield* Effect.promise(() => fs.writeFile(path.join(tmp.path, ".git", "config"), "needle\n"))
          const ripgrep = yield* Ripgrep.Service

          const files = yield* ripgrep.find({ cwd: tmp.path, pattern: "**/*", limit: 10 })
          expect(files.map((item) => item.path)).toContain(RelativePath.make(".opencode/config"))
          expect(files.map((item) => item.path)).not.toContain(RelativePath.make(".git/config"))

          const observed: string[] = []
          const limited = yield* ripgrep.find({
            cwd: tmp.path,
            pattern: "**/*",
            limit: 1,
            onEntry: (entry) => Effect.sync(() => observed.push(entry.path)),
          })
          expect(observed).toEqual(limited.map((item) => item.path))

          const matches = yield* ripgrep.grep({ cwd: tmp.path, pattern: "needle", include: "config", limit: 10 })
          expect(matches.map((item) => item.entry.path)).toContain(RelativePath.make(".opencode/config"))
          expect(matches.map((item) => item.entry.path)).not.toContain(RelativePath.make(".git/config"))
        }),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )
})
