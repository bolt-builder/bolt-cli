import { describe, expect, test } from "bun:test"
import { fuzzy, rank } from "../../src/cli/cmd/resume"

describe("resume.fuzzy", () => {
  test("matches subsequences case-insensitively", () => {
    expect(fuzzy("bb", "Billing Bug")).toBeDefined()
    expect(fuzzy("BILL", "billing bug")).toBeDefined()
  })

  test("rejects out-of-order characters", () => {
    expect(fuzzy("gub", "bug")).toBeUndefined()
    expect(fuzzy("xyz", "billing bug")).toBeUndefined()
  })

  test("scores denser matches lower", () => {
    const dense = fuzzy("bug", "bug hunt")
    const sparse = fuzzy("bug", "billing untangled gremlin")
    expect(dense).toBeDefined()
    expect(sparse).toBeDefined()
    expect(dense!).toBeLessThan(sparse!)
  })

  test("empty query matches everything with a zero score", () => {
    expect(fuzzy("", "anything")).toBe(0)
  })

  test("ignores spaces in the query", () => {
    expect(fuzzy("billing bug", "billingbug")).toBeDefined()
  })
})

describe("resume.rank", () => {
  const options = [
    { label: "fix login redirect", value: "ses_1", hint: "10:00 • ses_1" },
    { label: "billing bug", value: "ses_2", hint: "11:00 • ses_2" },
    { label: "write docs", value: "ses_3", hint: "12:00 • ses_3" },
  ]

  test("keeps the incoming order for an empty query", () => {
    expect(rank("", options).map((o) => o.value)).toEqual(["ses_1", "ses_2", "ses_3"])
  })

  test("filters out non-matching options", () => {
    expect(rank("billing", options).map((o) => o.value)).toEqual(["ses_2"])
  })

  test("ranks tighter matches first", () => {
    const ranked = rank("bug", options).map((o) => o.value)
    expect(ranked[0]).toBe("ses_2")
  })

  test("matches against the hint too", () => {
    expect(rank("ses_3", options).map((o) => o.value)).toContain("ses_3")
  })
})
