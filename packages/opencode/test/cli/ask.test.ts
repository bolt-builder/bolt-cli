import { describe, expect, test } from "bun:test"
import { compose, validModel } from "../../src/cli/cmd/ask"

describe("compose", () => {
  test("returns the question when nothing is piped", () => {
    expect(compose("why is this failing")).toBe("why is this failing")
  })

  test("returns the question when piped input is blank", () => {
    expect(compose("why is this failing", "  \n")).toBe("why is this failing")
  })

  test("appends piped input as context", () => {
    expect(compose("why is this failing", "TypeError: x is undefined\n")).toBe(
      "why is this failing\n\nContext:\nTypeError: x is undefined",
    )
  })
})

describe("validModel", () => {
  test("rejects a provider-only value", () => {
    expect(validModel("provider")).toBe(false)
  })

  test("rejects an empty provider", () => {
    expect(validModel("/model")).toBe(false)
  })

  test("accepts provider/model", () => {
    expect(validModel("anthropic/claude-sonnet-4")).toBe(true)
  })

  test("accepts model IDs containing slashes", () => {
    expect(validModel("openrouter/anthropic/claude-sonnet-4")).toBe(true)
  })
})
