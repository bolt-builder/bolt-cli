import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "fs/promises"
import os from "os"
import path from "path"
import { Memory } from "../src/memory"
import { MemoryDecay } from "../src/decay"
import { MemoryStamps } from "../src/storage/stamps"

const DAY = 86_400_000

async function tmp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bolt-memory-decay-"))
  return {
    dir,
    root: path.join(dir, "memory"),
    async done() {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

describe("decay scoring", () => {
  test("halves per half-life and clamps future stamps at 1", () => {
    const now = Date.now()
    expect(MemoryDecay.score({ updatedAt: now, now })).toBe(1)
    expect(MemoryDecay.score({ updatedAt: now - MemoryDecay.HALF_LIFE_DAYS * DAY, now })).toBeCloseTo(0.5)
    expect(MemoryDecay.score({ updatedAt: now - 2 * MemoryDecay.HALF_LIFE_DAYS * DAY, now })).toBeCloseTo(0.25)
    expect(MemoryDecay.score({ updatedAt: now + DAY, now })).toBe(1)
  })

  test("marks facts stale after two half-lives and never for unknown age", () => {
    const now = Date.now()
    expect(MemoryDecay.stale({ updatedAt: now - 2 * MemoryDecay.HALF_LIFE_DAYS * DAY - DAY, now })).toBe(true)
    expect(MemoryDecay.stale({ updatedAt: now - MemoryDecay.HALF_LIFE_DAYS * DAY, now })).toBe(false)
    expect(MemoryDecay.stale({ updatedAt: 0, now })).toBe(false)
    expect(MemoryDecay.stale({ now })).toBe(false)
  })

  test("honors a custom half-life", () => {
    const now = Date.now()
    expect(MemoryDecay.stale({ updatedAt: now - 3 * DAY, now, halfLifeDays: 1 })).toBe(true)
    expect(MemoryDecay.stale({ updatedAt: now - 3 * DAY, now, halfLifeDays: 30 })).toBe(false)
  })
})

describe("stamp ledger", () => {
  test("stamps writes, preserves createdAt on reconfirmation, and drops forgotten facts", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      const before = Date.now()
      await Memory.remember({ root: t.root, text: "Deploys run through the release pipeline." })

      const first = await MemoryStamps.read(t.root)
      const ids = Object.keys(first.items)
      expect(ids.length).toBe(1)
      const id = ids[0]!
      expect(first.items[id]!.createdAt).toBeGreaterThanOrEqual(before)
      expect(first.items[id]!.updatedAt).toBe(first.items[id]!.createdAt)

      // Backdate, then re-save the identical fact: reconfirmation refreshes updatedAt, keeps createdAt.
      const aged = { ...first.items[id]!, createdAt: before - 10 * DAY, updatedAt: before - 10 * DAY }
      await MemoryStamps.write(t.root, { version: 1, items: { [id]: aged } })
      await Memory.remember({ root: t.root, text: "Deploys run through the release pipeline." })
      const second = await MemoryStamps.read(t.root)
      expect(second.items[id]!.createdAt).toBe(before - 10 * DAY)
      expect(second.items[id]!.updatedAt).toBeGreaterThanOrEqual(before)

      await Memory.forget({ root: t.root, query: id.split(":").at(-1)! })
      const third = await MemoryStamps.read(t.root)
      expect(Object.keys(third.items).length).toBe(0)
    } finally {
      await t.done()
    }
  })

  test("overlays inventory timestamps from the ledger", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.remember({ root: t.root, text: "Migrations live under packages/core." })
      const stamps = await MemoryStamps.read(t.root)
      const id = Object.keys(stamps.items)[0]!
      const aged = 1_700_000_000_000
      await MemoryStamps.write(t.root, { version: 1, items: { [id]: { createdAt: aged, updatedAt: aged } } })

      const { MemoryFiles } = await import("../src/storage/store")
      const inventory = await MemoryFiles.deriveInventory(t.root)
      expect(inventory.items[id]!.updatedAt).toBe(aged)
      expect(inventory.items[id]!.createdAt).toBe(aged)
    } finally {
      await t.done()
    }
  })
})

describe("recall aging", () => {
  test("stale facts drop out of recall until a write reconfirms them", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.remember({ root: t.root, text: "Deploy target is the iad region on flyctl." })
      const fresh = await Memory.recall({ root: t.root, query: "deploy iad flyctl region" })
      expect(fresh.result?.hits.length).toBe(1)

      const stamps = await MemoryStamps.read(t.root)
      const id = Object.keys(stamps.items)[0]!
      const old = Date.now() - 200 * DAY
      await MemoryStamps.write(t.root, { version: 1, items: { [id]: { createdAt: old, updatedAt: old } } })
      const aged = await Memory.recall({ root: t.root, query: "deploy iad flyctl region" })
      expect(aged.result).toBeUndefined()

      await Memory.remember({ root: t.root, text: "Deploy target is the iad region on flyctl." })
      const confirmed = await Memory.recall({ root: t.root, query: "deploy iad flyctl region" })
      expect(confirmed.result?.hits.length).toBe(1)
    } finally {
      await t.done()
    }
  })

  test("forced recall still surfaces stale facts", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.remember({ root: t.root, text: "Legacy queue drains through sidekiq workers." })
      const stamps = await MemoryStamps.read(t.root)
      const id = Object.keys(stamps.items)[0]!
      const old = Date.now() - 200 * DAY
      await MemoryStamps.write(t.root, { version: 1, items: { [id]: { createdAt: old, updatedAt: old } } })

      const { MemoryRecall } = await import("../src/recall/recall")
      const forced = await MemoryRecall.search({ root: t.root, query: "sidekiq queue workers", force: true })
      expect(forced?.hits.length).toBe(1)
    } finally {
      await t.done()
    }
  })
})
