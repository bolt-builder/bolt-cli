import { describe, expect, test } from "bun:test"
import { tail } from "../../src/cli/cmd/refactor"

describe("tail", () => {
  test("returns short output unchanged", () => {
    expect(tail("FAIL src/a.test.ts")).toBe("FAIL src/a.test.ts")
  })

  test("trims surrounding whitespace", () => {
    expect(tail("\n  output  \n")).toBe("output")
  })

  test("keeps the tail when output exceeds the cap", () => {
    const output = `${"x".repeat(30)}END`
    expect(tail(output, 10)).toBe("[output truncated]\nxxxxxxxEND")
  })

  test("keeps output at exactly the cap", () => {
    const output = "y".repeat(10)
    expect(tail(output, 10)).toBe(output)
  })
})
