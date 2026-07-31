import { describe, expect, test } from "bun:test"
import { advance, cell, cells, seed, side, GLYPHS, PALETTE } from "../../src/ui/fire"

function rng(values: number[]) {
  let index = 0
  return () => values[index++ % values.length]
}

describe("fire", () => {
  test("seed produces a cold row of the requested width", () => {
    expect(seed(5)).toEqual([0, 0, 0, 0, 0])
    expect(seed(0)).toEqual([])
    expect(seed(-3)).toEqual([])
  })

  test("advance keeps heat within bounds", () => {
    const hot = advance(
      [1, 1, 1, 1],
      rng([0, 0.99]), // constant sparks with max boost
    )
    const cold = advance([0, 0, 0, 0], rng([0.99]))
    for (const value of hot) expect(value).toBeLessThanOrEqual(1)
    for (const value of hot) expect(value).toBeGreaterThanOrEqual(0)
    for (const value of cold) expect(value).toBe(0)
  })

  test("sparks ignite a cold row", () => {
    const row = advance(seed(4), rng([0])) // rng 0 always sparks
    for (const value of row) expect(value).toBeGreaterThan(0)
  })

  test("cell maps heat to glyph and color from the palettes", () => {
    expect(cell(0)).toEqual({ char: GLYPHS[0], color: PALETTE[0] })
    expect(cell(1).char).toBe(GLYPHS[GLYPHS.length - 1])
    expect(PALETTE).toContain(cell(0.5).color)
    expect(GLYPHS).toContain(cell(0.5).char)
  })

  test("cells maps a whole row", () => {
    const row = cells([0, 1])
    expect(row).toHaveLength(2)
    expect(row[0].char).toBe(GLYPHS[0])
    expect(row[1].color).toBe(PALETTE[PALETTE.length - 1])
  })

  test("side flickers within the bright half of the palette", () => {
    expect(PALETTE.indexOf(side([0, 0, 0]))).toBeGreaterThanOrEqual(3)
    expect(PALETTE.indexOf(side([1, 1, 1]))).toBe(PALETTE.length - 1)
    expect(side([])).toBe(PALETTE[4])
  })
})
