import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "fs/promises"
import os from "os"
import path from "path"
import { Memory } from "../src/memory"
import { MemoryFiles } from "../src/storage/store"
import { MemoryStaging } from "../src/staging"

async function tmp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bolt-memory-staging-"))
  return {
    dir,
    root: path.join(dir, "memory"),
    async done() {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

describe("staging store", () => {
  test("parses only well-formed pending items", () => {
    const store = MemoryStaging.parse({
      version: 1,
      review: true,
      items: [
        { op: { action: "add", key: "a", text: "b" }, at: 5, sessionID: "ses_1" },
        { op: { action: "remove", query: "gone" }, at: 6 },
        { op: { action: "add", key: "", text: "b" }, at: 7 },
        { op: { action: "nope" }, at: 8 },
        "junk",
      ],
    })
    expect(store.review).toBe(true)
    expect(store.items.length).toBe(2)
    expect(MemoryStaging.parse(undefined)).toEqual({ version: 1, review: false, items: [] })
  })

  test("stages, reads back, and clears", async () => {
    const t = await tmp()
    try {
      await MemoryStaging.configure(t.root, { review: true })
      const staged = await MemoryStaging.stage(t.root, {
        ops: [{ action: "add", key: "deploy_region", text: "Deploys go to iad." }],
        sessionID: "ses_1",
        now: 123,
      })
      expect(staged).toEqual({ count: 1, total: 1 })
      const store = await MemoryStaging.read(t.root)
      expect(store.items[0]!.sessionID).toBe("ses_1")
      expect(await MemoryStaging.clear(t.root)).toBe(1)
      expect((await MemoryStaging.read(t.root)).items).toEqual([])
      expect(await MemoryStaging.enabled(t.root)).toBe(true)
    } finally {
      await t.done()
    }
  })
})

describe("diff rendering", () => {
  test("marks additions, updates, unchanged lines, and removals", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.remember({ root: t.root, key: "deploy_region", text: "Deploys go to ord." })
      const inventory = await MemoryFiles.deriveInventory(t.root)
      const lines = MemoryStaging.render({
        inventory,
        items: [
          { op: { action: "add", key: "deploy_region", text: "Deploys go to iad." }, at: 1, sessionID: "ses_9" },
          { op: { action: "add", key: "deploy_region", text: "Deploys go to ord." }, at: 2 },
          { op: { action: "add", key: "new_fact", text: "Fresh fact." }, at: 3 },
          { op: { action: "remove", query: "deploy_region" }, at: 4 },
        ],
      })
      expect(lines[0]).toBe(
        "~ project.md > Facts > deploy_region :: Deploys go to iad. (was: Deploys go to ord.) (session ses_9)",
      )
      expect(lines[1]).toBe("= project.md > Facts > deploy_region :: Deploys go to ord.")
      expect(lines[2]).toBe("+ project.md > Facts > new_fact :: Fresh fact.")
      expect(lines[3]).toBe("- forget: deploy_region")
    } finally {
      await t.done()
    }
  })
})

describe("review mode", () => {
  test("stages auto-captured writes and persists them on approval", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.review({ root: t.root, review: true })

      const captured = await Memory.apply({
        root: t.root,
        trigger: "turn-close",
        sessionID: "ses_auto",
        ops: [{ action: "add", key: "test_command", text: "Run bun test from packages/memory." }],
      })
      expect(captured.staged).toBe(1)
      expect(captured.ok).toBe(false)

      const before = await Memory.show({ root: t.root })
      expect(before.sources.project).not.toContain("bun test")

      const pending = await Memory.pending({ root: t.root })
      expect(pending.diff.length).toBe(1)
      expect(pending.diff[0]).toContain("+ project.md > Facts > test_command")

      const approved = await Memory.approve({ root: t.root })
      expect(approved.applied).toBe(1)
      expect(approved.added).toBe(1)

      const after = await Memory.show({ root: t.root })
      expect(after.sources.project).toContain("bun test")
      expect((await Memory.pending({ root: t.root })).items).toEqual([])
    } finally {
      await t.done()
    }
  })

  test("explicit saves bypass staging and discard drops the queue", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.review({ root: t.root, review: true })

      const explicit = await Memory.remember({ root: t.root, text: "Explicit facts persist immediately." })
      expect(explicit.staged).toBeUndefined()
      expect(explicit.ok).toBe(true)

      await Memory.apply({
        root: t.root,
        trigger: "turn-close",
        ops: [{ action: "add", key: "auto_fact", text: "Captured for review." }],
      })
      const dropped = await Memory.discard({ root: t.root })
      expect(dropped.discarded).toBe(1)
      const shown = await Memory.show({ root: t.root })
      expect(shown.sources.project).not.toContain("Captured for review")
    } finally {
      await t.done()
    }
  })

  test("review off keeps auto-capture writing directly", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      const captured = await Memory.apply({
        root: t.root,
        trigger: "turn-close",
        ops: [{ action: "add", key: "direct_fact", text: "Writes land without review." }],
      })
      expect(captured.staged).toBeUndefined()
      expect(captured.ok).toBe(true)
    } finally {
      await t.done()
    }
  })
})
