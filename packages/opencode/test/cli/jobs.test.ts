import { describe, expect, test } from "bun:test"
import { alive } from "../../src/cli/cmd/jobs"

describe("alive", () => {
  test("detects the current process", () => {
    expect(alive(process.pid)).toBe(true)
  })

  test("rejects a zero pid", () => {
    expect(alive(0)).toBe(false)
  })

  test("rejects a pid that cannot exist", () => {
    expect(alive(2 ** 30)).toBe(false)
  })
})
