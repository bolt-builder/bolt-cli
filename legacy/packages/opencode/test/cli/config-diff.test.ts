import { describe, expect, test } from "bun:test"
import { changes, line } from "../../src/cli/cmd/config/diff"

describe("changes", () => {
  test("reports added keys", () => {
    expect(changes({}, { model: "a/b" })).toEqual([{ path: "model", kind: "added", after: "a/b" }])
  })

  test("reports removed keys", () => {
    expect(changes({ snapshot: false }, {})).toEqual([{ path: "snapshot", kind: "removed", before: false }])
  })

  test("reports changed leaves with before and after", () => {
    expect(changes({ model: "a/b" }, { model: "c/d" })).toEqual([
      { path: "model", kind: "changed", before: "a/b", after: "c/d" },
    ])
  })

  test("walks nested objects and ignores unchanged keys", () => {
    const base = { provider: { anthropic: { options: { baseURL: "x" } } }, model: "a/b" }
    const next = { provider: { anthropic: { options: { baseURL: "y" } } }, model: "a/b" }
    expect(changes(base, next)).toEqual([
      { path: "provider.anthropic.options.baseURL", kind: "changed", before: "x", after: "y" },
    ])
  })

  test("treats arrays as leaf values", () => {
    expect(changes({ instructions: ["A.md"] }, { instructions: ["A.md", "B.md"] })).toEqual([
      { path: "instructions", kind: "changed", before: ["A.md"], after: ["A.md", "B.md"] },
    ])
  })

  test("returns nothing for identical configs", () => {
    expect(changes({ model: "a/b", compaction: { auto: true } }, { model: "a/b", compaction: { auto: true } })).toEqual(
      [],
    )
  })

  test("sorts results by path", () => {
    const result = changes({ zebra: 1 }, { alpha: 2, zebra: 1 })
    expect(result.map((item) => item.path)).toEqual(["alpha"])
  })
})

describe("line", () => {
  test("formats each change kind", () => {
    expect(line({ path: "model", kind: "added", after: "a/b" })).toBe('  + model = "a/b"')
    expect(line({ path: "snapshot", kind: "removed", before: true })).toBe("  - snapshot (was true)")
    expect(line({ path: "model", kind: "changed", before: "a", after: "b" })).toBe('  ~ model: "a" -> "b"')
  })
})
