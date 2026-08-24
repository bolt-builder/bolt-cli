import { describe, expect, test } from "bun:test"
import { field, matches, validate } from "../../src/cli/cmd/cron"

describe("field", () => {
  test("expands stars", () => {
    expect(field("*", 0, 3)).toEqual(new Set([0, 1, 2, 3]))
  })

  test("expands steps", () => {
    expect(field("*/15", 0, 59)).toEqual(new Set([0, 15, 30, 45]))
  })

  test("expands ranges and lists", () => {
    expect(field("1-3,5", 0, 59)).toEqual(new Set([1, 2, 3, 5]))
  })

  test("rejects out of bounds values", () => {
    expect(field("61", 0, 59)).toBeUndefined()
    expect(field("5-1", 0, 59)).toBeUndefined()
  })

  test("rejects stepped single values", () => {
    expect(field("5/2", 0, 59)).toBeUndefined()
  })
})

describe("validate", () => {
  test("accepts a normal expression", () => {
    expect(validate("*/30 9-17 * * 1-5")).toBeUndefined()
  })

  test("rejects wrong field counts", () => {
    expect(validate("* * *")).toContain("5 fields")
  })

  test("rejects bad fields with position info", () => {
    expect(validate("* 25 * * *")).toContain("position 2")
  })
})

describe("matches", () => {
  test("matches minute and hour", () => {
    const date = new Date(2026, 7, 6, 9, 30)
    expect(matches("30 9 * * *", date)).toBe(true)
    expect(matches("31 9 * * *", date)).toBe(false)
  })

  test("treats 7 as sunday", () => {
    const sunday = new Date(2026, 7, 9, 0, 0)
    expect(sunday.getDay()).toBe(0)
    expect(matches("0 0 * * 7", sunday)).toBe(true)
    expect(matches("0 0 * * 0", sunday)).toBe(true)
  })

  test("respects day of month and month", () => {
    const date = new Date(2026, 0, 15, 12, 0)
    expect(matches("0 12 15 1 *", date)).toBe(true)
    expect(matches("0 12 16 1 *", date)).toBe(false)
    expect(matches("0 12 15 2 *", date)).toBe(false)
  })

  test("ORs day-of-month and day-of-week when both are restricted", () => {
    // 2026-01-01 is a Thursday (getDay() === 4).
    const firstOfMonth = new Date(2026, 0, 1, 0, 0)
    expect(firstOfMonth.getDate()).toBe(1)
    expect(firstOfMonth.getDay()).toBe(4)
    // "1st OR Monday": matches on the 1st even though it is not a Monday.
    expect(matches("0 0 1 * 1", firstOfMonth)).toBe(true)
    // ...and matches on a Monday that is not the 1st.
    const monday = new Date(2026, 0, 5, 0, 0)
    expect(monday.getDay()).toBe(1)
    expect(matches("0 0 1 * 1", monday)).toBe(true)
    // A Thursday that is not the 1st matches neither, so no run.
    const otherThursday = new Date(2026, 0, 8, 0, 0)
    expect(otherThursday.getDay()).toBe(4)
    expect(matches("0 0 1 * 1", otherThursday)).toBe(false)
  })
})
