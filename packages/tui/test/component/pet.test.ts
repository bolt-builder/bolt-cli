import { describe, expect, test } from "bun:test"
import { SPECIES, W, H, compose, roster, type Seg } from "../../src/component/pet"

const expand = (row: Seg[]) => row.flatMap((seg) => seg.text.split("").map((char) => ({ char, fg: seg.fg })))

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

  test("compose renders a constant-height strip of half-block rows", () => {
    // Height must never vary per frame: resizing the strip forces the whole
    // app to relayout on every animation tick.
    for (const state of ["idle", "busy", "attention"] as const) {
      for (const frame of [0, 1]) {
        const rows = compose([{ id: 1, species: "blob", x: 0, dir: 1 as const }], frame, state, 40, "#fbbf24")
        expect(rows.length).toBe(H / 2)
        for (const row of rows) expect(expand(row).length).toBe(40)
      }
    }
    const rows = compose([{ id: 1, species: "cat", x: 0, dir: 1 as const }], 0, "idle", 40, "#fbbf24")
    const chars = new Set(rows.flatMap(expand).map((px) => px.char))
    expect(chars.has("▀")).toBe(true)
  })

  test("compose run-length encodes rows instead of one span per cell", () => {
    const rows = compose([{ id: 1, species: "cat", x: 10, dir: 1 as const }], 0, "idle", 200, "#fbbf24")
    for (const row of rows) {
      expect(expand(row).length).toBe(200)
      expect(row.length).toBeLessThan(40)
    }
  })

  test("compose mirrors a pet walking left", () => {
    const right = compose([{ id: 1, species: "cat", x: 0, dir: 1 as const }], 0, "idle", W, "#fbbf24")
    const left = compose([{ id: 1, species: "cat", x: 0, dir: -1 as const }], 0, "idle", W, "#fbbf24")
    const colors = (rows: Seg[][]) => rows.map((row) => expand(row).map((px) => px.fg))
    expect(colors(left)).toEqual(colors(right).map((row) => row.slice().reverse()))
  })

  test("attention frames flash the alert overlay", () => {
    for (const species of Object.values(SPECIES)) {
      const marked = species.states.attention.some((frame) => frame.some((row) => row.includes("!")))
      expect(marked).toBe(true)
    }
  })

  test("roster normalizes malformed persisted values", () => {
    expect(roster(undefined)).toEqual([])
    expect(roster(null)).toEqual([])
    expect(roster("cat")).toEqual([])
    expect(roster({ cat: 1 })).toEqual([])
    expect(roster([1, "cat", null, "unicorn", "dog"])).toEqual(["cat", "dog"])
  })
})
