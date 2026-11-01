import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "fs/promises"
import os from "os"
import path from "path"
import { Memory } from "../src/memory"
import { MemorySearch } from "../src/search"

async function tmp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bolt-memory-search-"))
  return {
    dir,
    root: path.join(dir, "memory"),
    async done() {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

function doc(input: Partial<MemorySearch.Doc> & { id: string; text: string }): MemorySearch.Doc {
  return { source: "project.md", section: "Facts", key: input.id, ...input }
}

describe("search ranking", () => {
  test("rare terms outweigh corpus-wide terms", () => {
    const docs = [
      doc({ id: "a", text: "The deploy pipeline uses the shared runner pool." }),
      doc({ id: "b", text: "The deploy pipeline uses flyctl for the api service." }),
      doc({ id: "c", text: "The deploy pipeline uses caching for artifacts." }),
    ]
    const hits = MemorySearch.rank({ docs, query: "deploy pipeline flyctl" })
    expect(hits[0]!.doc.id).toBe("b")
  })

  test("key matches outrank body-only matches", () => {
    const docs = [
      doc({ id: "a", key: "release_checklist", text: "Steps to follow before shipping a version." }),
      doc({ id: "b", key: "ci_notes", text: "The release checklist gets reviewed by the oncall rotation regularly." }),
    ]
    const hits = MemorySearch.rank({ docs, query: "release checklist" })
    expect(hits.length).toBe(2)
    expect(hits[0]!.doc.id).toBe("a")
  })

  test("suffix-tolerant matching bridges tests and test", () => {
    const hits = MemorySearch.rank({
      docs: [doc({ id: "a", text: "Widget tests run from the package directory." })],
      query: "test widget",
    })
    expect(hits.length).toBe(1)
  })

  test("returns nothing for empty queries or corpora", () => {
    expect(MemorySearch.rank({ docs: [], query: "anything" })).toEqual([])
    expect(MemorySearch.rank({ docs: [doc({ id: "a", text: "something" })], query: "  " })).toEqual([])
    expect(MemorySearch.rank({ docs: [doc({ id: "a", text: "something" })], query: "unrelated" })).toEqual([])
  })

  test("caps results at the limit, best first", () => {
    const docs = [
      doc({ id: "a", text: "bun runs tests" }),
      doc({ id: "b", text: "bun runs tests and builds and bundles" }),
      doc({ id: "c", text: "bun runs" }),
    ]
    const hits = MemorySearch.rank({ docs, query: "bun tests", limit: 2 })
    expect(hits.length).toBe(2)
    expect(hits[0]!.score).toBeGreaterThanOrEqual(hits[1]!.score)
  })

  test("breaks score ties by freshness", () => {
    const docs = [
      doc({ id: "a", text: "bun test runs the suite", updatedAt: 1000 }),
      doc({ id: "b", text: "bun test runs the suite", updatedAt: 2000 }),
    ]
    const hits = MemorySearch.rank({ docs, query: "bun test suite" })
    expect(hits[0]!.doc.id).toBe("b")
  })
})

describe("search over the store", () => {
  test("finds typed facts and session digests", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.remember({ root: t.root, text: "Coverage reports upload to codecov after the unit suite." })
      await Memory.recordSession({
        root: t.root,
        sessionID: "ses_reports",
        topic: "coverage work",
        summary: "Wired codecov uploads into the unit suite pipeline.",
      })

      const output = await MemorySearch.search({ root: t.root, query: "codecov coverage uploads" })
      expect(output.enabled).toBe(true)
      expect(output.hits.length).toBe(2)
      const sources = output.hits.map((hit) => hit.doc.source)
      expect(sources).toContain("project.md")
      expect(sources).toContain("sessions")
    } finally {
      await t.done()
    }
  })

  test("reports disabled stores without searching", async () => {
    const t = await tmp()
    try {
      const output = await MemorySearch.search({ root: t.root, query: "anything" })
      expect(output.enabled).toBe(false)
      expect(output.hits).toEqual([])
    } finally {
      await t.done()
    }
  })
})
