import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "fs/promises"
import os from "os"
import path from "path"
import { Memory } from "../src/memory"
import { MemoryNegative } from "../src/negative"
import { MemorySchema } from "../src/schema"

async function tmp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bolt-memory-negative-"))
  return {
    dir,
    root: path.join(dir, "memory"),
    async done() {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

describe("negative phrasing", () => {
  test("prefixes bare approaches and keeps failure phrasing", () => {
    expect(MemoryNegative.text({ approach: "bumping the pool size to fix timeouts" })).toBe(
      "did not work: bumping the pool size to fix timeouts.",
    )
    expect(MemoryNegative.text({ approach: "Mocking the clock failed under bun test" })).toBe(
      "Mocking the clock failed under bun test.",
    )
    expect(MemoryNegative.text({ approach: "raising retries", outcome: "it masked the real deadlock" })).toBe(
      "did not work: raising retries (it masked the real deadlock).",
    )
  })

  test("detects negative entries by section or phrasing", () => {
    expect(MemoryNegative.is({ section: "Failed Approaches", text: "anything" })).toBe(true)
    expect(MemoryNegative.is({ section: "Facts", text: "did not work: raising retries." })).toBe(true)
    expect(MemoryNegative.is({ section: "Facts", text: "Use bun for tests." })).toBe(false)
  })

  test("maps failed sections to their own record kind", () => {
    expect(MemorySchema.kind("project.md", "Failed Approaches")).toBe("failed_approach")
    expect(MemorySchema.recordKind("project.md", "Failed Approaches")).toBe("FAILED_APPROACH")
  })
})

describe("avoid facade", () => {
  test("stores failed approaches and recalls them as warnings", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.avoid({
        root: t.root,
        text: "patching the scheduler tick to silence flaky timers",
        outcome: "it hid a real race",
      })

      const shown = await Memory.show({ root: t.root })
      expect(shown.sources.project).toContain("## Failed Approaches")
      expect(shown.sources.project).toContain("did not work: patching the scheduler tick")

      const recall = await Memory.recall({ root: t.root, query: "scheduler tick flaky timers" })
      expect(recall.result?.hits.length).toBe(1)
      expect(recall.result?.hits[0]?.kind).toBe("FAILED_APPROACH")
      expect(recall.result?.block).toContain("failed_approach")
    } finally {
      await t.done()
    }
  })

  test("forgetting a failed approach works by key", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.avoid({ root: t.root, key: "pool_bump", text: "bumping the pool size" })
      await Memory.forget({ root: t.root, query: "pool_bump" })
      const shown = await Memory.show({ root: t.root })
      expect(shown.sources.project).not.toContain("pool size")
    } finally {
      await t.done()
    }
  })
})
