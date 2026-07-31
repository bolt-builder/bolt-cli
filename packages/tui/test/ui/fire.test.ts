import { describe, expect, test } from "bun:test"
import { cell, cells, ignite, GLYPHS, MAX, PALETTE, ROWS } from "../../src/ui/fire"

describe("fire", () => {
  test("ignite produces a grid of width * rows heat values in range", async () => {
    const engine = await ignite(40)
    const grid = engine.grid()
    expect(grid.length).toBe(40 * ROWS)
    for (const heat of grid) {
      expect(heat).toBeGreaterThanOrEqual(0)
      expect(heat).toBeLessThanOrEqual(MAX)
    }
  })

  test("source row stays hot and tips stay cooler", async () => {
    const engine = await ignite(40)
    for (let i = 0; i < 30; i++) engine.advance()
    const grid = engine.grid()
    const source = grid.subarray(40 * (ROWS - 1))
    const tips = grid.subarray(0, 40)
    expect(Math.max(...source)).toBeGreaterThan(MAX / 2)
    const mean = (row: Uint8Array) => row.reduce((sum, heat) => sum + heat, 0) / row.length
    expect(mean(source)).toBeGreaterThan(mean(tips))
  })

  test("advance survives the upstream panic by respawning", async () => {
    const engine = await ignite(60)
    // The upstream wasm traps nondeterministically; hundreds of advances make
    // hitting it near-certain, and advance must recover every time.
    for (let i = 0; i < 2000; i++) engine.advance()
    expect(engine.grid().length).toBe(60 * ROWS)
  })

  test("cell maps zero heat to blank and max heat to the brightest glyph", () => {
    expect(cell(0).char).toBe(" ")
    expect(cell(MAX).char).toBe(GLYPHS[GLYPHS.length - 1])
    expect(cell(MAX).color).toBe(PALETTE[PALETTE.length - 1])
    for (let heat = 0; heat <= MAX; heat++) {
      expect(GLYPHS).toContain(cell(heat).char)
      expect(PALETTE).toContain(cell(heat).color)
    }
  })

  test("narrow grids still burn despite the upstream 35-column seeding quirk", async () => {
    const engine = await ignite(20)
    for (let i = 0; i < 30; i++) engine.advance()
    const grid = engine.grid()
    expect(grid.length).toBe(20 * ROWS)
    expect(Math.max(...grid)).toBeGreaterThan(MAX / 2)
  })

  test("cells splits the flat grid into rows of rendered cells", async () => {
    const engine = await ignite(20)
    for (let i = 0; i < 10; i++) engine.advance()
    const rows = cells(engine.grid(), 20)
    expect(rows.length).toBe(ROWS)
    for (const row of rows) expect(row.length).toBe(20)
  })
})
