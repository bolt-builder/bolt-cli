import { describe, expect, test } from "bun:test"
import { SPECIES, W, H, compose } from "../../src/component/pet"

describe("pet sprites", () => {
  test("every frame is a full-size grid of known palette pixels", () => {
    for (const [name, species] of Object.entries(SPECIES)) {
      for (const [state, frames] of Object.entries(species.states)) {
        expect(frames.length).toBeGreaterThan(1)
        for (const frame of frames) {
          expect(frame.length).toBe(H)
          for (const row of frame) {
            expect(row.length).toBe(W)
            for (const ch of row) {
              if (ch === "." || ch === "!") continue
              expect(species.colors[ch], `${name}/${state} uses unknown pixel "${ch}"`).toBeDefined()
            }
          }
        }
      }
    }
  })

  test("compose renders half-block rows and trims empty leading rows", () => {
    const rows = compose([{ species: "cat", x: 0, dir: 1 as const }], 0, "idle", 40, "#fbbf24")
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThanOrEqual(H / 2)
    for (const row of rows) expect(row.length).toBe(40)
    const chars = new Set(rows.flat().map((px) => px.char))
    expect(chars.has("▀")).toBe(true)
    expect(rows[0].some((px) => px.char !== " ")).toBe(true)
  })

  test("compose mirrors a pet walking left", () => {
    const right = compose([{ species: "cat", x: 0, dir: 1 as const }], 0, "idle", W, "#fbbf24")
    const left = compose([{ species: "cat", x: 0, dir: -1 as const }], 0, "idle", W, "#fbbf24")
    const flip = right.map((row) => row.slice().reverse().map((px) => ({ char: px.char === "▀" ? "▀" : px.char, fg: px.fg, bg: px.bg })))
    expect(left.map((row) => row.map((px) => px.fg))).toEqual(flip.map((row) => row.map((px) => px.fg)))
  })

  test("attention frames flash the alert overlay", () => {
    for (const species of Object.values(SPECIES)) {
      const marked = species.states.attention.some((frame) => frame.some((row) => row.includes("!")))
      expect(marked).toBe(true)
    }
  })
})
