import { describe, expect, test } from "bun:test"
import { verdict } from "@/session/tool-budget"

describe("tool-budget.verdict", () => {
  test("allows every call when no limit is configured", () => {
    expect(verdict(1)).toEqual({ used: 1, allowed: true })
    expect(verdict(10_000)).toEqual({ used: 10_000, allowed: true })
  })

  test("allows calls up to the limit", () => {
    expect(verdict(1, 2)).toEqual({ used: 1, limit: 2, allowed: true })
    expect(verdict(2, 2)).toEqual({ used: 2, limit: 2, allowed: true })
  })

  test("denies calls beyond the limit", () => {
    expect(verdict(3, 2)).toEqual({ used: 3, limit: 2, allowed: false })
  })
})
