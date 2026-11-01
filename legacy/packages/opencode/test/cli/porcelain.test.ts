import { describe, expect, test } from "bun:test"
import { Porcelain } from "../../src/cli/porcelain"

describe("escape", () => {
  test("keeps plain values untouched", () => {
    expect(Porcelain.escape("provider/model")).toBe("provider/model")
  })

  test("escapes tabs, newlines, and backslashes", () => {
    expect(Porcelain.escape("a\tb\nc\rd\\e")).toBe("a\\tb\\nc\\rd\\\\e")
  })
})

describe("line", () => {
  test("joins fields with tabs", () => {
    expect(Porcelain.line("model", "openai/gpt-5")).toBe("model\topenai/gpt-5")
  })

  test("one record is always exactly one line", () => {
    expect(Porcelain.line("text", "first\nsecond").split("\n")).toHaveLength(1)
  })

  test("records stay grep-safe field by field", () => {
    const fields = Porcelain.line("tool", "bash", "completed").split("\t")
    expect(fields).toEqual(["tool", "bash", "completed"])
  })
})
