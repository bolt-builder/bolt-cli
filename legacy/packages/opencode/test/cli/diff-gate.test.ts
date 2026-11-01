import { describe, expect, test } from "bun:test"
import { blocking, issues, rank } from "../../src/cli/cmd/diff-gate"

describe("issues", () => {
  test("parses severities from list items", () => {
    const found = issues(
      [
        "- critical: src/a.ts:12 leaks a file handle",
        "- major: src/b.ts:3 misses the error branch",
        "- minor: naming nit",
        "",
        "Verdict: FAIL",
      ].join("\n"),
    )
    expect(found.map((issue) => issue.severity)).toEqual(["critical", "major", "minor"])
  })

  test("accepts numbered lists and mixed case", () => {
    const found = issues("1. Major: off by one\n2) MINOR: typo")
    expect(found.map((issue) => issue.severity)).toEqual(["major", "minor"])
  })

  test("ignores prose and the verdict line", () => {
    expect(issues("This is a critical part of the system.\n\nVerdict: PASS")).toEqual([])
  })

  test("ignores list items without a severity", () => {
    expect(issues("- looks good\n- ship it")).toEqual([])
  })
})

describe("blocking", () => {
  const found = issues(["- critical: a", "- major: b", "- minor: c"].join("\n"))

  test("major threshold blocks major and critical", () => {
    expect(blocking(found, "major").map((issue) => issue.severity)).toEqual(["critical", "major"])
  })

  test("critical threshold blocks only critical", () => {
    expect(blocking(found, "critical").map((issue) => issue.severity)).toEqual(["critical"])
  })

  test("minor threshold blocks everything", () => {
    expect(blocking(found, "minor")).toHaveLength(3)
  })

  test("empty reviews block nothing", () => {
    expect(blocking([], "minor")).toEqual([])
  })
})

describe("rank", () => {
  test("orders severities", () => {
    expect(rank("minor")).toBeLessThan(rank("major"))
    expect(rank("major")).toBeLessThan(rank("critical"))
  })
})
