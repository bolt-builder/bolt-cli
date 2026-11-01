import { describe, expect, test } from "bun:test"
import { duration, parse, table } from "../../src/cli/cmd/batch"

describe("parse", () => {
  test("returns one prompt per non-empty line", () => {
    expect(parse("first prompt\n\nsecond prompt\n")).toEqual(["first prompt", "second prompt"])
  })

  test("skips comment lines", () => {
    expect(parse("# a comment\nreal prompt\n  # indented comment")).toEqual(["real prompt"])
  })

  test("joins backslash continuations", () => {
    expect(parse("long prompt \\\nwith a second half")).toEqual(["long prompt  with a second half"])
  })

  test("trims whitespace", () => {
    expect(parse("  padded  \n")).toEqual(["padded"])
  })

  test("returns nothing for empty input", () => {
    expect(parse("")).toEqual([])
    expect(parse("\n# only comments\n")).toEqual([])
  })
})

describe("duration", () => {
  test("formats milliseconds, seconds, and minutes", () => {
    expect(duration(250)).toBe("250ms")
    expect(duration(1500)).toBe("1.5s")
    expect(duration(61_000)).toBe("1m1s")
  })
})

describe("table", () => {
  test("lists every row with status and duration", () => {
    const out = table([
      { index: 1, status: "ok", duration: 1200, prompt: "add a test" },
      { index: 2, status: "error", duration: 300, prompt: "break things", detail: "empty response" },
    ])
    expect(out).toContain("add a test")
    expect(out).toContain("error")
    expect(out).toContain("(empty response)")
    expect(out).toContain("1/2 succeeded")
  })

  test("truncates long prompts", () => {
    const long = "x".repeat(100)
    const out = table([{ index: 1, status: "ok", duration: 10, prompt: long }])
    expect(out).toContain("x".repeat(57) + "...")
    expect(out).not.toContain("x".repeat(61))
  })

  test("reports full success", () => {
    const out = table([{ index: 1, status: "ok", duration: 10, prompt: "p" }])
    expect(out).toContain("1/1 succeeded")
  })
})
