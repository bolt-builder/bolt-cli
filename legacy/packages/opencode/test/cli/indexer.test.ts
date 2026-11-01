import { describe, expect, test } from "bun:test"
import { digest, fnv, indexable, query, refresh, render, vector } from "../../src/cli/cmd/indexer"

const EMPTY = { version: 1 as const, files: {} }

const PARSER = [
  "export function parseConfig(raw: string) {",
  "  const config = readSettings(raw)",
  "  return validateConfig(config)",
  "}",
].join("\n")

const CACHE = [
  "export function evictCache(store: Store) {",
  "  const stale = store.entries.filter(isExpired)",
  "  return stale.map(remove)",
  "}",
].join("\n")

describe("fnv and digest", () => {
  test("are deterministic and change with content", () => {
    expect(fnv("alpha")).toBe(fnv("alpha"))
    expect(digest("alpha")).toBe(digest("alpha"))
    expect(digest("alpha")).not.toBe(digest("alpha!"))
  })
})

describe("vector", () => {
  test("is L2-normalized and deterministic", () => {
    const embedded = vector(PARSER)
    expect(embedded.length).toBe(128)
    const norm = embedded.reduce((sum, value) => sum + value * value, 0)
    expect(norm).toBeCloseTo(1, 2)
    expect(vector(PARSER)).toEqual(embedded)
  })

  test("returns a zero vector for token-free text", () => {
    expect(vector("!!! ???").every((value) => value === 0)).toBe(true)
  })
})

describe("refresh", () => {
  test("adds new files with chunk vectors", () => {
    const result = refresh(EMPTY, { "parser.ts": PARSER })
    expect(result.stats).toEqual({ added: 1, updated: 0, removed: 0, unchanged: 0 })
    expect(result.index.files["parser.ts"].chunks.length).toBe(1)
    expect(result.index.files["parser.ts"].chunks[0].start).toBe(1)
  })

  test("keeps unchanged entries and re-embeds changed ones", () => {
    const first = refresh(EMPTY, { "parser.ts": PARSER, "cache.ts": CACHE }).index
    const second = refresh(first, { "parser.ts": PARSER, "cache.ts": `${CACHE}\nexport const extra = 1` })
    expect(second.stats).toEqual({ added: 0, updated: 1, removed: 0, unchanged: 1 })
    expect(second.index.files["parser.ts"]).toBe(first.files["parser.ts"])
    expect(second.index.files["cache.ts"].hash).not.toBe(first.files["cache.ts"].hash)
  })

  test("drops files that disappeared", () => {
    const first = refresh(EMPTY, { "parser.ts": PARSER, "cache.ts": CACHE }).index
    const second = refresh(first, { "parser.ts": PARSER })
    expect(second.stats.removed).toBe(1)
    expect(second.index.files["cache.ts"]).toBeUndefined()
  })
})

describe("query", () => {
  test("ranks the semantically closer file first", () => {
    const built = refresh(EMPTY, { "parser.ts": PARSER, "cache.ts": CACHE }).index
    const hits = query(built, "parse and validate the config settings")
    expect(hits[0].file).toBe("parser.ts")
    expect(hits[0].score).toBeGreaterThan(hits.find((hit) => hit.file === "cache.ts")?.score ?? 0)
  })

  test("caps hits at the limit", () => {
    const built = refresh(EMPTY, { "parser.ts": PARSER, "cache.ts": CACHE }).index
    expect(query(built, "config store", 1).length).toBe(1)
  })
})

describe("render", () => {
  test("prints score and location per hit", () => {
    const built = refresh(EMPTY, { "parser.ts": PARSER }).index
    const text = render(query(built, "parse config"))
    expect(text).toMatch(/^0\.\d{3} parser\.ts:1-4\n$/)
  })

  test("says so when nothing matches", () => {
    expect(render([])).toBe("No matches.\n")
  })
})

describe("indexable", () => {
  test("accepts source files and rejects skipped directories", () => {
    expect(indexable("src/cli/cmd/indexer.ts")).toBe(true)
    expect(indexable("tool/main.go")).toBe(true)
    expect(indexable("node_modules/pkg/main.ts")).toBe(false)
    expect(indexable("docs/readme.md")).toBe(false)
  })
})
