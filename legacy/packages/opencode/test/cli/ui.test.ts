import { afterEach, describe, expect, test } from "bun:test"
import { UI } from "../../src/cli/ui"

const saved = process.env.NO_COLOR

afterEach(() => {
  if (saved === undefined) {
    delete process.env.NO_COLOR
    return
  }
  process.env.NO_COLOR = saved
})

describe("strip", () => {
  test("removes ANSI style sequences", () => {
    expect(UI.strip(`${UI.Style.TEXT_DANGER_BOLD}Error:${UI.Style.TEXT_NORMAL} boom`)).toBe("Error: boom")
  })

  test("keeps plain text untouched", () => {
    expect(UI.strip("plain text")).toBe("plain text")
  })
})

describe("colors", () => {
  test("enabled when NO_COLOR is unset", () => {
    delete process.env.NO_COLOR
    expect(UI.colors()).toBe(true)
  })

  test("enabled when NO_COLOR is empty per the spec", () => {
    process.env.NO_COLOR = ""
    expect(UI.colors()).toBe(true)
  })

  test("disabled when NO_COLOR is set to any value", () => {
    process.env.NO_COLOR = "1"
    expect(UI.colors()).toBe(false)
  })
})
