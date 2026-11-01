import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "fs/promises"
import os from "os"
import path from "path"
import { Memory } from "../src/memory"
import { MemoryPortable } from "../src/portable"

async function tmp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bolt-memory-"))
  return {
    dir,
    root: path.join(dir, "memory"),
    async done() {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

describe("portable serialization", () => {
  test("serializes sources into one document and parses them back", () => {
    const output = MemoryPortable.serialize({
      sources: {
        "project.md": "## Facts\n- runtime :: The service targets Bun.\n- style :: Avoid destructuring.\n",
        "environment.md": "## Commands\n- test :: Run bun test from packages/memory.\n",
      },
      at: Date.parse("2026-08-07T00:00:00.000Z"),
    })

    expect(output.count).toBe(3)
    expect(output.text).toContain(MemoryPortable.TITLE)
    expect(output.text).toContain("Exported: 2026-08-07T00:00:00.000Z")
    expect(output.text).toContain("## project.md")
    expect(output.text).toContain("### Facts")
    expect(output.text).toContain("- runtime :: The service targets Bun.")

    const parsed = MemoryPortable.parse(output.text)
    expect(parsed.skipped).toEqual([])
    expect(parsed.ops).toEqual([
      { action: "add", file: "project.md", section: "Facts", key: "runtime", text: "The service targets Bun." },
      { action: "add", file: "project.md", section: "Facts", key: "style", text: "Avoid destructuring." },
      {
        action: "add",
        file: "environment.md",
        section: "Commands",
        key: "test",
        text: "Run bun test from packages/memory.",
      },
    ])
  })

  test("skips empty sources and unknown file blocks", () => {
    const output = MemoryPortable.serialize({
      sources: { "project.md": "## Facts\n- runtime :: The service targets Bun.\n", "corrections.md": "" },
    })
    expect(output.text).not.toContain("## corrections.md")

    const parsed = MemoryPortable.parse(`${output.text}\n## notes.md\n\n### Facts\n- extra :: Not a memory source.\n`)
    expect(parsed.skipped).toEqual(["notes.md"])
    expect(parsed.ops).toHaveLength(1)
    expect(parsed.ops[0].file).toBe("project.md")
  })
})

describe("portable facade", () => {
  test("dump and load round-trip project memory into a fresh root", async () => {
    const source = await tmp()
    const target = await tmp()
    try {
      await Memory.enable({ root: source.root })
      await Memory.remember({
        root: source.root,
        file: "environment.md",
        section: "Commands",
        text: "Run bun test from packages/memory.",
      })
      await Memory.remember({ root: source.root, section: "Facts", text: "The default branch in this repo is dev." })

      const dumped = await Memory.dump({ root: source.root })
      expect(dumped.count).toBe(2)

      await Memory.enable({ root: target.root })
      const loaded = await Memory.load({ root: target.root, text: dumped.text })
      expect(loaded.ops).toBe(2)
      expect(loaded.applied).toBe(2)
      expect(loaded.added).toBe(2)
      expect(loaded.skipped).toEqual([])

      const recall = await Memory.recall({ root: target.root, query: "bun test packages memory" })
      expect(recall.hits?.some((hit) => hit.text.includes("Run bun test"))).toBe(true)
    } finally {
      await source.done()
      await target.done()
    }
  })

  test("load reports empty documents without applying anything", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      const loaded = await Memory.load({ root: t.root, text: "# Bolt project memory export\n" })
      expect(loaded.ops).toBe(0)
      expect(loaded.applied).toBe(0)
    } finally {
      await t.done()
    }
  })
})
