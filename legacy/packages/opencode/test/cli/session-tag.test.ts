import { describe, expect, test } from "bun:test"
import { tags, toggle } from "../../src/cli/cmd/session"

describe("session.tag.tags", () => {
  test("reads tags from metadata", () => {
    expect(tags({ tags: ["billing-bug", "urgent"] })).toEqual(["billing-bug", "urgent"])
  })

  test("returns empty for missing metadata", () => {
    expect(tags(undefined)).toEqual([])
    expect(tags({})).toEqual([])
  })

  test("ignores non-array tag values", () => {
    expect(tags({ tags: "billing-bug" })).toEqual([])
  })

  test("drops non-string entries", () => {
    expect(tags({ tags: ["ok", 42, null, "fine"] })).toEqual(["ok", "fine"])
  })
})

describe("session.tag.toggle", () => {
  test("adds new tags", () => {
    expect(toggle(["a"], ["b"], false)).toEqual(["a", "b"])
  })

  test("deduplicates while preserving order", () => {
    expect(toggle(["a", "b"], ["b", "c", "c"], false)).toEqual(["a", "b", "c"])
  })

  test("removes tags", () => {
    expect(toggle(["a", "b", "c"], ["b"], true)).toEqual(["a", "c"])
  })

  test("removing a missing tag is a no-op", () => {
    expect(toggle(["a"], ["zzz"], true)).toEqual(["a"])
  })
})
