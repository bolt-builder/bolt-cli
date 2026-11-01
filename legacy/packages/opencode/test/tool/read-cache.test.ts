import { describe, expect, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { ReadCache } from "../../src/tool/read-cache"

function directory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bolt-read-cache-"))
}

function entry(overrides?: Partial<ReadCache.Entry>): ReadCache.Entry {
  return {
    mtime: 1000,
    size: 10,
    raw: ["hello"],
    count: 1,
    cut: false,
    more: false,
    offset: 1,
    ...overrides,
  }
}

describe("read cache", () => {
  test("misses when nothing is stored", async () => {
    expect(await ReadCache.get(directory(), "/a.ts", 1, 2000, { mtime: 1000, size: 10 })).toBeUndefined()
  })

  test("hits when mtime and size match", async () => {
    const dir = directory()
    const stored = entry()
    await ReadCache.set(dir, "/a.ts", 1, 2000, stored)
    expect(await ReadCache.get(dir, "/a.ts", 1, 2000, { mtime: 1000, size: 10 })).toEqual(stored)
  })

  test("misses when the file changed", async () => {
    const dir = directory()
    await ReadCache.set(dir, "/a.ts", 1, 2000, entry())
    expect(await ReadCache.get(dir, "/a.ts", 1, 2000, { mtime: 2000, size: 10 })).toBeUndefined()
    expect(await ReadCache.get(dir, "/a.ts", 1, 2000, { mtime: 1000, size: 11 })).toBeUndefined()
  })

  test("misses when offset or limit differ", async () => {
    const dir = directory()
    await ReadCache.set(dir, "/a.ts", 1, 2000, entry())
    expect(await ReadCache.get(dir, "/a.ts", 5, 2000, { mtime: 1000, size: 10 })).toBeUndefined()
    expect(await ReadCache.get(dir, "/a.ts", 1, 100, { mtime: 1000, size: 10 })).toBeUndefined()
  })

  test("persists entries to disk for later runs", async () => {
    const dir = directory()
    await ReadCache.set(dir, "/a.ts", 1, 2000, entry())
    const stored = (await Bun.file(ReadCache.location(dir)).json()) as { entries: Record<string, unknown> }
    expect(Object.keys(stored.entries)).toEqual([ReadCache.key("/a.ts", 1, 2000)])
  })

  test("evicts the oldest entries beyond the cap", async () => {
    const dir = directory()
    for (const index of Array.from({ length: 105 }, (_, index) => index)) {
      await ReadCache.set(dir, `/file-${index}.ts`, 1, 2000, entry())
    }
    expect(await ReadCache.get(dir, "/file-0.ts", 1, 2000, { mtime: 1000, size: 10 })).toBeUndefined()
    expect(await ReadCache.get(dir, "/file-104.ts", 1, 2000, { mtime: 1000, size: 10 })).toBeDefined()
  })
})
