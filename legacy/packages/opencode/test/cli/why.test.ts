import { describe, expect, test } from "bun:test"
import { cited, entries, span } from "../../src/cli/cmd/why"

const SHA1 = "a".repeat(40)
const SHA2 = "b".repeat(40)

describe("entries", () => {
  test("parses formatted log output", () => {
    const text = `${SHA1}\x00Ada\x00Mon Jan 1\x00feat: add retries\x01${SHA2}\x00Grace\x00Tue Jan 2\x00fix: cap retries\x01`
    const found = entries(text)
    expect(found).toHaveLength(2)
    expect(found[0]).toEqual({ sha: SHA1, author: "Ada", date: "Mon Jan 1", subject: "feat: add retries" })
    expect(found[1].subject).toBe("fix: cap retries")
  })

  test("skips malformed chunks", () => {
    expect(entries(`not a commit\x01${SHA1}\x00Ada\x00Mon\x00ok\x01`)).toHaveLength(1)
  })

  test("returns nothing for empty output", () => {
    expect(entries("")).toEqual([])
  })
})

describe("span", () => {
  test("parses a single line", () => {
    expect(span("120")).toEqual({ start: 120, end: 120 })
  })

  test("parses a range", () => {
    expect(span("120,160")).toEqual({ start: 120, end: 160 })
  })

  test("rejects inverted or invalid ranges", () => {
    expect(span("160,120")).toBeUndefined()
    expect(span("0")).toBeUndefined()
    expect(span("abc")).toBeUndefined()
    expect(span("12-40")).toBeUndefined()
  })
})

describe("cited", () => {
  test("collects shas the answer mentions by short sha", () => {
    const text = `The cap landed in ${SHA2.slice(0, 7)} the day after retries appeared.`
    expect(cited(text, [SHA1, SHA2])).toEqual([SHA2])
  })

  test("returns nothing when no evidence is cited", () => {
    expect(cited("It changed at some point.", [SHA1, SHA2])).toEqual([])
  })
})
