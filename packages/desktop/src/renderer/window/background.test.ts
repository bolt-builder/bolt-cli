import { describe, expect, test } from "bun:test"
import { windowBackground } from "./background"

describe("native window background", () => {
  test.each([
    ["rgb(5, 8, 20)", "#050814"],
    ["rgb(255, 255, 255)", "#ffffff"],
    ["rgb(17, 32, 128)", "#112080"],
    ["rgba(5, 8, 20, 0.5)", "#80050814"],
    ["var(--v2-grey-100)", undefined],
    ["rgb(999, 0, 0)", undefined],
  ])("converts resolved renderer color %s", (input, expected) => {
    expect(windowBackground(input)).toBe(expected)
  })
})
