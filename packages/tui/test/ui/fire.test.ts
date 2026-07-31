import { describe, expect, test } from "bun:test"
import { advance, cell, cells, seed, side, GLYPHS, PALETTE, ROWS } from "../../src/ui/fire"

function rng(values: number[]) {
  let index = 0
  return () => values[index++ % values.length]
}

describe("fire", () => {
  test("seed produces a grid with a hot source row and cold tips", () => {
    const grid = seed(4)
    expect(grid).toHaveLength(ROWS)
    for (const row of grid) expect(row).toHaveLength(4)
    expect(grid[ROWS - 1]).toEqual([1, 1, 1, 1])
    expect(grid[0]).toEqual([0, 0, 0, 0])
    expect(seed(0).every((row) => row.length === 0)).toBe(true)
    expect(seed(-3).every((row) => row.length === 0)).toBe(true)
  })

  test("advance keeps heat within bounds and the source row hot", () => {
    const grid = Array.from({ length: 20 }).reduce<number[][]>((acc) => advance(acc), seed(6))
    for (const row of grid) {
      for (const value of row) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
    for (const value of grid[grid.length - 1]) expect(value).toBeGreaterThanOrEqual(0.85)
  })

  test("heat decays away from the source so tips are ragged", () => {
    // rng cycles: drift pick, decay for every non-source cell; 0.5 keeps it deterministic-ish
    const grid = advance(advance(seed(4), rng([0.5])), rng([0.5]))
    const mean = (row: number[]) => row.reduce((sum, value) => sum + value, 0) / row.length
    expect(mean(grid[0])).toBeLessThan(mean(grid[grid.length - 1]))
  })

  test("cell maps heat to glyph and color from the palettes", () => {
    expect(cell(0)).toEqual({ char: " ", color: PALETTE[0] })
    expect(cell(1).char).toBe("█")
    expect(GLYPHS).toContain(cell(0.5).char)
    expect(PALETTE).toContain(cell(0.5).color)
  })

  test("cells maps a whole grid", () => {
    const grid = cells([
      [0, 1],
      [1, 0],
    ])
    expect(grid).toHaveLength(2)
    expect(grid[0][0].char).toBe(" ")
    expect(grid[0][1].char).toBe("█")
    expect(grid[1][0].color).toBe(PALETTE[PALETTE.length - 1])
  })

  test("side flickers within the bright end of the palette", () => {
    expect(PALETTE.indexOf(side(seed(3)))).toBeGreaterThanOrEqual(4)
    expect(side([[]])).toBe(PALETTE[5])
  })
})
