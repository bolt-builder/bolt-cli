import { describe, expect, test } from "bun:test"
import { Envelope } from "../../src/cli/envelope"

describe("success", () => {
  test("wraps the result in a versioned envelope", () => {
    expect(JSON.parse(Envelope.success({ id: "x" }))).toEqual({
      version: Envelope.VERSION,
      ok: true,
      result: { id: "x" },
    })
  })

  test("emits a single line", () => {
    expect(Envelope.success({ text: "a\nb" }).split("\n")).toHaveLength(1)
  })
})

describe("failure", () => {
  test("wraps the error in a versioned envelope", () => {
    expect(JSON.parse(Envelope.failure("SessionError", "boom"))).toEqual({
      version: Envelope.VERSION,
      ok: false,
      error: { name: "SessionError", message: "boom" },
    })
  })
})
