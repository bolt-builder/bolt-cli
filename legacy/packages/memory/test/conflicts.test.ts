import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "fs/promises"
import os from "os"
import path from "path"
import { Memory } from "../src/memory"
import { MemoryConflicts } from "../src/conflicts"

async function tmp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bolt-memory-conflicts-"))
  return {
    dir,
    root: path.join(dir, "memory"),
    async done() {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

function item(input: Partial<MemoryConflicts.Item> & { id: string; text: string }): MemoryConflicts.Item {
  return {
    file: "project.md",
    section: "Facts",
    key: input.id,
    ...input,
  }
}

describe("conflict detection", () => {
  test("flags opposing polarity over a shared subject", () => {
    const found = MemoryConflicts.detect([
      item({ id: "a", text: "Always run database migrations with bun run migrate before deploys." }),
      item({ id: "b", text: "Never run database migrations with bun run migrate before deploys." }),
    ])
    expect(found.length).toBe(1)
    expect(found[0]!.reason).toBe("polarity")
  })

  test("ignores unrelated facts and agreeing facts", () => {
    const found = MemoryConflicts.detect([
      item({ id: "a", text: "Use bun for package management." }),
      item({ id: "b", text: "The TUI lives in packages/tui." }),
      item({ id: "c", text: "Use bun workspaces for package management tasks." }),
    ])
    expect(found).toEqual([])
  })

  test("flags the same key stored twice with different text", () => {
    const found = MemoryConflicts.detect([
      item({ id: "a", key: "deploy_region", text: "Deploys go to iad." }),
      item({ id: "b", key: "deploy_region", section: "Decisions", text: "Deploys go to ord." }),
    ])
    expect(found.length).toBe(1)
    expect(found[0]!.reason).toBe("duplicate")
  })

  test("flags a correction that supersedes an older fact", () => {
    const found = MemoryConflicts.detect([
      item({ id: "a", text: "The api service deploys to the ord fly region nightly." }),
      item({
        id: "b",
        file: "corrections.md",
        section: "Corrections",
        text: "The api service deploys to the iad fly region nightly.",
      }),
    ])
    expect(found.length).toBe(1)
    expect(found[0]!.reason).toBe("correction")
  })
})

describe("conflict resolution", () => {
  test("corrections win regardless of age", () => {
    const fact = item({ id: "a", text: "The api service deploys to the ord fly region nightly.", updatedAt: 2000 })
    const fix = item({
      id: "b",
      file: "corrections.md",
      section: "Corrections",
      text: "The api service deploys to the iad fly region nightly.",
      updatedAt: 1000,
    })
    const plan = MemoryConflicts.resolve(MemoryConflicts.detect([fact, fix]))
    expect(plan.resolutions.length).toBe(1)
    expect(plan.resolutions[0]!.keep.id).toBe("b")
    expect(plan.resolutions[0]!.op).toEqual({ action: "remove", query: "project.md:Facts:a" })
  })

  test("the newer fact wins a polarity conflict and ties stay unresolved", () => {
    const older = item({ id: "a", text: "Always gate deploys on the smoke suite.", updatedAt: 1000 })
    const newer = item({ id: "b", text: "Never gate deploys on the smoke suite.", updatedAt: 2000 })
    const plan = MemoryConflicts.resolve(MemoryConflicts.detect([older, newer]))
    expect(plan.resolutions[0]!.keep.id).toBe("b")
    expect(plan.resolutions[0]!.drop.id).toBe("a")

    const tie = MemoryConflicts.resolve(
      MemoryConflicts.detect([item({ ...older, updatedAt: 1000 }), item({ ...newer, id: "c", updatedAt: 1000 })]),
    )
    expect(tie.resolutions).toEqual([])
    expect(tie.unresolved.length).toBe(1)
  })

  test("drops each losing fact at most once", () => {
    const fact = item({ id: "a", text: "The api service never deploys to the ord fly region.", updatedAt: 1000 })
    const one = item({ id: "b", text: "The api service deploys to the ord fly region daily.", updatedAt: 2000 })
    const two = item({ id: "c", text: "The api service deploys to the ord fly region weekly.", updatedAt: 3000 })
    const plan = MemoryConflicts.resolve(MemoryConflicts.detect([fact, one, two]))
    const dropped = plan.resolutions.map((it) => it.drop.id)
    expect(new Set(dropped).size).toBe(dropped.length)
  })
})

describe("facade integration", () => {
  test("detects and fixes a superseded fact end to end", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.remember({ root: t.root, text: "The api service deploys to the ord fly region nightly." })
      await Memory.correct({ root: t.root, text: "The api service deploys to the iad fly region nightly." })

      const found = await Memory.conflicts({ root: t.root })
      expect(found.applied).toBe(false)
      expect(found.conflicts.some((c) => c.reason === "correction")).toBe(true)
      expect(found.plan.resolutions.length).toBe(1)

      const fixed = await Memory.conflicts({ root: t.root, fix: true })
      expect(fixed.applied).toBe(true)

      const shown = await Memory.show({ root: t.root })
      expect(shown.sources.project).not.toContain("ord fly region")
      expect(shown.sources.corrections).toContain("iad fly region")

      const clean = await Memory.conflicts({ root: t.root })
      expect(clean.conflicts).toEqual([])
    } finally {
      await t.done()
    }
  })
})
