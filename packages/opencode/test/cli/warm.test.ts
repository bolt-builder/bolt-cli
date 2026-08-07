import { describe, expect, test } from "bun:test"
import { elapsed } from "../../src/cli/cmd/warm"

describe("warm elapsed", () => {
  test("rounds to whole milliseconds", () => {
    expect(elapsed(0, 12.4)).toBe("12ms")
    expect(elapsed(0, 12.6)).toBe("13ms")
  })

  test("clamps negative durations to zero", () => {
    expect(elapsed(100, 50)).toBe("0ms")
  })
})
