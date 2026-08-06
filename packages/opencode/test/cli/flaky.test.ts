import { describe, expect, test } from "bun:test"
import { verdict } from "../../src/cli/cmd/flaky"

describe("verdict", () => {
  test("all zero exit codes are a stable pass", () => {
    expect(verdict([0, 0, 0])).toBe("pass")
  })

  test("all failing exit codes are a stable fail", () => {
    expect(verdict([1, 1, 2])).toBe("fail")
  })

  test("mixed exit codes are flaky", () => {
    expect(verdict([0, 1, 0])).toBe("flaky")
  })

  test("empty input has no verdict", () => {
    expect(verdict([])).toBeUndefined()
  })
})
