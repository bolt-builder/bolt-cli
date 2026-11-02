import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "fs/promises"
import os from "os"
import path from "path"
import { Memory } from "../src/memory"
import { MemoryTeam } from "../src/team"

async function tmp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bolt-memory-team-"))
  return {
    dir,
    root: path.join(dir, "memory"),
    worktree: path.join(dir, "repo"),
    async done() {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

describe("team file", () => {
  test("init creates the shared file once", async () => {
    const t = await tmp()
    try {
      const first = await MemoryTeam.init(t.worktree)
      expect(first.created).toBe(true)
      expect(first.file).toBe(path.join(t.worktree, ".bolt", "memory.md"))
      const second = await MemoryTeam.init(t.worktree)
      expect(second.created).toBe(false)
      expect(await MemoryTeam.exists(t.worktree)).toBe(true)
    } finally {
      await t.done()
    }
  })

  test("share upserts entries and read parses them back", async () => {
    const t = await tmp()
    try {
      await MemoryTeam.share(t.worktree, [
        { section: "Facts", key: "deploy_region", text: "Deploys go to iad." },
        { section: "Commands", key: "test_command", text: "Run bun test from package dirs." },
      ])
      await MemoryTeam.share(t.worktree, [{ section: "Facts", key: "deploy_region", text: "Deploys go to ord." }])

      const shared = await MemoryTeam.read(t.worktree)
      expect(shared.items.length).toBe(2)
      expect(shared.items.find((item) => item.key === "deploy_region")?.text).toBe("Deploys go to ord.")
      expect(shared.updatedAt).toBeGreaterThan(0)

      const text = await readFile(path.join(t.worktree, ".bolt", "memory.md"), "utf8")
      expect(text).toContain("## Commands")
    } finally {
      await t.done()
    }
  })

  test("read reports empty when the repo has not opted in", async () => {
    const t = await tmp()
    try {
      const shared = await MemoryTeam.read(t.worktree)
      expect(shared.items).toEqual([])
      expect(shared.updatedAt).toBe(0)
    } finally {
      await t.done()
    }
  })
})

describe("share selection", () => {
  const items = [
    { id: "project.md:Facts:deploy_region", file: "project.md", section: "Facts", key: "deploy_region", text: "iad" },
    { id: "project.md:Facts:other", file: "project.md", section: "Facts", key: "other", text: "x" },
  ]

  test("matches by key, id, and aliases", () => {
    expect(MemoryTeam.match({ items, query: "deploy_region" }).length).toBe(1)
    expect(MemoryTeam.match({ items, query: "project.md:Facts:deploy_region" }).length).toBe(1)
    expect(MemoryTeam.match({ items, query: "project.md:deploy_region" }).length).toBe(1)
    expect(MemoryTeam.match({ items, query: "Deploy Region" }).length).toBe(1)
    expect(MemoryTeam.match({ items, query: "missing" })).toEqual([])
    expect(MemoryTeam.match({ items, query: "  " })).toEqual([])
  })
})

describe("team recall", () => {
  test("committed team memory surfaces in recall alongside personal facts", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await MemoryTeam.share(t.worktree, [
        { section: "Facts", key: "queue_backend", text: "The queue backend runs on redpanda brokers." },
      ])

      const hit = await Memory.recall({
        root: t.root,
        query: "queue backend redpanda brokers",
        worktree: t.worktree,
      })
      expect(hit.result?.hits.length).toBe(1)
      expect(hit.result?.hits[0]?.source).toBe("team.md")
      expect(hit.result?.hits[0]?.kind).toBe("TEAM")

      const without = await Memory.recall({ root: t.root, query: "queue backend redpanda brokers" })
      expect(without.result).toBeUndefined()
    } finally {
      await t.done()
    }
  })
})
