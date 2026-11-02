import { describe, expect, test } from "bun:test"
import { median } from "../../script/bench-startup"

describe("bench-startup median", () => {
  test("odd count returns middle value", () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  test("even count returns mean of middle values", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  test("single value returns itself", () => {
    expect(median([42])).toBe(42)
  })

  test("does not mutate input", () => {
    const values = [5, 1, 3]
    median(values)
    expect(values).toEqual([5, 1, 3])
  })
})
