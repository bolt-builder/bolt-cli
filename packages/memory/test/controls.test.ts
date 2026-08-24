import { describe, expect, test } from "bun:test"
import { MemoryControls } from "../src/controls"

describe("memory controls", () => {
  test("default to on when metadata is missing or untouched", () => {
    expect(MemoryControls.use(undefined)).toBe(true)
    expect(MemoryControls.use(null)).toBe(true)
    expect(MemoryControls.use({})).toBe(true)
    expect(MemoryControls.contribute(undefined)).toBe(true)
    expect(MemoryControls.contribute({ sandbox: true })).toBe(true)
  })

  test("only an explicit false opts the session out", () => {
    expect(MemoryControls.use({ [MemoryControls.USE]: false })).toBe(false)
    expect(MemoryControls.use({ [MemoryControls.USE]: true })).toBe(true)
    expect(MemoryControls.use({ [MemoryControls.USE]: "off" })).toBe(true)
    expect(MemoryControls.contribute({ [MemoryControls.CONTRIBUTE]: false })).toBe(false)
    expect(MemoryControls.contribute({ [MemoryControls.CONTRIBUTE]: true })).toBe(true)
  })

  test("controls are independent", () => {
    const metadata = { [MemoryControls.USE]: false }
    expect(MemoryControls.use(metadata)).toBe(false)
    expect(MemoryControls.contribute(metadata)).toBe(true)
  })
})
