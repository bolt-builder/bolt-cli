import { afterEach, describe, expect, test } from "bun:test"
import { Pager } from "../src/util/pager"

const saved = { PAGER: process.env.PAGER, EDITOR: process.env.EDITOR, VISUAL: process.env.VISUAL }

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    if (value !== undefined) process.env[key] = value
  }
})

describe("command", () => {
  test("prefers $PAGER", () => {
    process.env.PAGER = "bat --paging=always"
    expect(Pager.command()).toBe("bat --paging=always")
  })

  test("falls back to less when $PAGER is unset or blank", () => {
    process.env.PAGER = "  "
    expect(Pager.command()).toBe("less -R")
  })
})

describe("overflows", () => {
  test("short output fits", () => {
    expect(Pager.overflows("a\nb\n", 24, 80)).toBe(false)
  })

  test("long output overflows", () => {
    const text = Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n")
    expect(Pager.overflows(text, 24, 80)).toBe(true)
  })

  test("counts rows taken by wrapped long lines", () => {
    const text = `${"x".repeat(200)}\nshort\n`
    expect(Pager.overflows(text, 4, 80)).toBe(false)
    expect(Pager.overflows(text, 4, 40)).toBe(true)
  })

  test("ignores color escapes when measuring width", () => {
    expect(Pager.overflows(`\x1b[31m${"x".repeat(70)}\x1b[0m\n`, 1, 80)).toBe(false)
  })
})
