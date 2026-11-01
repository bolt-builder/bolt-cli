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
    expect(Pager.overflows("a\nb\n", 24)).toBe(false)
  })

  test("long output overflows", () => {
    const text = Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n")
    expect(Pager.overflows(text, 24)).toBe(true)
  })
})
