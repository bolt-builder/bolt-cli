import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { Memory } from "../src/memory"
import { MemoryToolchain } from "../src/toolchain"

async function tmp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bolt-memory-toolchain-"))
  return {
    dir,
    root: path.join(dir, "memory"),
    worktree: path.join(dir, "repo"),
    async done() {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

function commands(found: MemoryToolchain.Command[]) {
  return Object.fromEntries(found.map((item) => [item.key, item.command]))
}

describe("toolchain detection", () => {
  test("reads package.json scripts with the lockfile's package manager", () => {
    const files = {
      "package.json": JSON.stringify({ scripts: { test: "bun test", build: "tsc", deploy: "x" } }),
      "bun.lock": "",
    }
    const found = commands(MemoryToolchain.detect({ files }))
    expect(found.test_command).toBe("bun run test")
    expect(found.build_command).toBe("bun run build")
    expect(found.deploy_command).toBeUndefined()
    expect(MemoryToolchain.manager({ "pnpm-lock.yaml": "" })).toBe("pnpm")
    expect(MemoryToolchain.manager({})).toBe("npm")
  })

  test("reads Makefile targets, cargo, go, and pytest manifests", () => {
    const found = commands(
      MemoryToolchain.detect({
        files: {
          Makefile: "lint:\n\techo lint\n\nbuild:\n\techo build\n",
          "Cargo.toml": "[package]",
          "go.mod": "module example.com/x",
          "pyproject.toml": "[tool.pytest.ini_options]",
          "uv.lock": "",
        },
      }),
    )
    expect(found.lint_command).toBe("make lint")
    expect(found.build_command).toBe("make build")
    expect(found.test_command).toBe("cargo test")
    expect(found.typecheck_command).toBeUndefined()
  })

  test("first ecosystem wins colliding keys and malformed manifests contribute nothing", () => {
    const found = commands(
      MemoryToolchain.detect({
        files: {
          "package.json": JSON.stringify({ scripts: { test: "bun test" } }),
          "Cargo.toml": "[package]",
          "composer.json": "{ not json",
        },
      }),
    )
    expect(found.test_command).toBe("npm run test")
    expect(found.build_command).toBe("cargo build")
  })

  test("detects nothing in an empty repo", () => {
    expect(MemoryToolchain.detect({ files: {} })).toEqual([])
  })
})

describe("toolchain learning", () => {
  test("scans the worktree and persists commands into environment memory", async () => {
    const t = await tmp()
    try {
      await mkdir(t.worktree, { recursive: true })
      await writeFile(
        path.join(t.worktree, "package.json"),
        JSON.stringify({ scripts: { test: "bun test", typecheck: "tsgo --noEmit" } }),
      )
      await writeFile(path.join(t.worktree, "bun.lock"), "")
      await Memory.enable({ root: t.root })

      const output = await MemoryToolchain.learn({ root: t.root, worktree: t.worktree })
      expect(output.applied).toBe(2)

      const shown = await Memory.show({ root: t.root })
      expect(shown.sources.environment).toContain("test_command")
      expect(shown.sources.environment).toContain("`bun run typecheck`")

      const recall = await Memory.recall({ root: t.root, query: "typecheck command tsgo" })
      expect(recall.result?.hits.length).toBe(1)

      // Re-learning is idempotent: the same commands upsert in place.
      const again = await MemoryToolchain.learn({ root: t.root, worktree: t.worktree })
      expect(again.entries.length).toBe(2)
      const repeat = await Memory.show({ root: t.root })
      expect(repeat.sources.environment.match(/test_command/g)?.length).toBe(1)
    } finally {
      await t.done()
    }
  })

  test("learns nothing without manifests", async () => {
    const t = await tmp()
    try {
      await mkdir(t.worktree, { recursive: true })
      await Memory.enable({ root: t.root })
      const output = await MemoryToolchain.learn({ root: t.root, worktree: t.worktree })
      expect(output).toEqual({ entries: [], applied: 0 })
    } finally {
      await t.done()
    }
  })
})
