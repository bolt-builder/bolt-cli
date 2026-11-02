import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { Memory } from "../src/memory"
import { MemoryScopes } from "../src/scopes"

async function tmp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bolt-memory-scopes-"))
  return {
    dir,
    root: path.join(dir, "memory"),
    async done() {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

describe("scope sections", () => {
  test("round-trips scopes through section names", () => {
    expect(MemoryScopes.section("packages/tui")).toBe("Scope: packages/tui")
    expect(MemoryScopes.parse("Scope: packages/tui")).toBe("packages/tui")
    expect(MemoryScopes.parse("Facts")).toBeUndefined()
  })

  test("cleans scope inputs", () => {
    expect(MemoryScopes.clean("./packages/tui/")).toBe("packages/tui")
    expect(MemoryScopes.clean("packages\\tui")).toBe("packages/tui")
    expect(MemoryScopes.clean(".")).toBe("")
    expect(MemoryScopes.clean("  ")).toBe("")
  })
})

describe("scope resolution", () => {
  const worktree = "/repo"

  test("picks the deepest containing scope root", () => {
    const roots = ["packages", "packages/tui", "packages/opencode"]
    expect(MemoryScopes.resolve({ worktree, directory: "/repo/packages/tui/src", roots })).toBe("packages/tui")
    expect(MemoryScopes.resolve({ worktree, directory: "/repo/packages/docs", roots })).toBe("packages")
    expect(MemoryScopes.resolve({ worktree, directory: "/repo", roots })).toBe("")
    expect(MemoryScopes.resolve({ worktree, directory: "/elsewhere", roots })).toBe("")
  })

  test("applies covers the scope subtree and keeps the root all-seeing", () => {
    expect(MemoryScopes.applies({ scope: "packages/tui", active: "packages/tui" })).toBe(true)
    expect(MemoryScopes.applies({ scope: "packages/tui", active: "packages/tui/src" })).toBe(true)
    expect(MemoryScopes.applies({ scope: "packages/tui", active: "packages/opencode" })).toBe(false)
    expect(MemoryScopes.applies({ scope: "packages/tui", active: "" })).toBe(true)
    expect(MemoryScopes.applies({ scope: "", active: "packages/tui" })).toBe(true)
  })

  test("locates the deepest marker directory under the worktree", async () => {
    const t = await tmp()
    try {
      const worktree = path.join(t.dir, "repo")
      await mkdir(path.join(worktree, "packages", "tui", "src"), { recursive: true })
      await writeFile(path.join(worktree, "package.json"), "{}")
      await writeFile(path.join(worktree, "packages", "tui", "package.json"), "{}")

      expect(await MemoryScopes.locate({ worktree, directory: path.join(worktree, "packages", "tui", "src") })).toBe(
        "packages/tui",
      )
      expect(await MemoryScopes.locate({ worktree, directory: path.join(worktree, "packages") })).toBe("")
      expect(await MemoryScopes.locate({ worktree, directory: worktree })).toBe("")
      expect(await MemoryScopes.locate({ worktree, directory: t.dir })).toBe("")
    } finally {
      await t.done()
    }
  })
})

describe("scoped recall", () => {
  test("scoped facts surface in their scope, hide elsewhere, and stay visible at the root", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.remember({
        root: t.root,
        scope: "packages/tui",
        text: "The tui bundle ships themed widget styling via themer tokens.",
      })
      await Memory.remember({
        root: t.root,
        text: "The repository pins bun as the package manager toolchain runner.",
      })

      const inside = await Memory.recall({
        root: t.root,
        query: "themed widget styling themer tokens",
        scope: "packages/tui",
      })
      expect(inside.result?.hits.length).toBe(1)

      const nested = await Memory.recall({
        root: t.root,
        query: "themed widget styling themer tokens",
        scope: "packages/tui/src/component",
      })
      expect(nested.result?.hits.length).toBe(1)

      const foreign = await Memory.recall({
        root: t.root,
        query: "themed widget styling themer tokens",
        scope: "packages/opencode",
      })
      expect(foreign.result).toBeUndefined()

      const root = await Memory.recall({ root: t.root, query: "themed widget styling themer tokens" })
      expect(root.result?.hits.length).toBe(1)

      const unscoped = await Memory.recall({
        root: t.root,
        query: "bun package manager toolchain runner",
        scope: "packages/opencode",
      })
      expect(unscoped.result?.hits.length).toBe(1)
    } finally {
      await t.done()
    }
  })

  test("matching-scope facts outrank unscoped facts on equal lexical score", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.remember({
        root: t.root,
        key: "tui_test_command",
        scope: "packages/tui",
        text: "Run the widget suite with bun test from the tui package.",
      })
      await Memory.remember({
        root: t.root,
        key: "repo_test_command",
        text: "Run the widget suite with bun test from the repository root.",
      })

      const result = await Memory.recall({
        root: t.root,
        query: "widget suite bun test",
        scope: "packages/tui",
      })
      expect(result?.result?.hits[0]?.text).toContain("tui_test_command")
    } finally {
      await t.done()
    }
  })
})
