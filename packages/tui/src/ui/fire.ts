// Fire bar above the chatbox while the agent works. The heat field comes from
// @seomis/doom-fire, a Rust/wasm port of the PSX DOOM fire algorithm
// (http://fabiensanglard.net/doom_fire_psx/); this module only loads the wasm
// and maps heat values to glyphs and colors.
//
// Package quirks handled here:
// - the wasm-bindgen glue imports "./doom_fire_bg" without an extension, which
//   Bun cannot resolve, so we instantiate the .wasm directly
// - fire_get_width/fire_get_height are swapped upstream, so we track our own
//   dimensions instead of asking the wasm
// - fire_update_cells occasionally traps on an out-of-bounds drift, so advance
//   respawns the instance when that happens
import wasm from "@seomis/doom-fire/doom_fire_bg.wasm" with { type: "file" }

// The classic 36-color DOOM fire palette, black ember to white-hot core,
// indexed directly by heat.
export const PALETTE = [
  "#070707",
  "#1f0707",
  "#2f0f07",
  "#470f07",
  "#571707",
  "#671f07",
  "#771f07",
  "#8f2707",
  "#9f2f07",
  "#af3f07",
  "#bf4707",
  "#c74707",
  "#df4f07",
  "#df5707",
  "#df5707",
  "#d75f07",
  "#d75f07",
  "#d7670f",
  "#cf6f0f",
  "#cf770f",
  "#cf7f0f",
  "#cf8717",
  "#c78717",
  "#c78f17",
  "#c7971f",
  "#bf9f1f",
  "#bf9f1f",
  "#bfa727",
  "#bfa727",
  "#bfaf2f",
  "#b7af2f",
  "#b7b72f",
  "#b7b737",
  "#cfcf6f",
  "#dfdf9f",
  "#ffffff",
]

// Display rows; rendered as ROWS / 2 text rows of half-block pixels.
export const ROWS = 32

// The wasm needs vertical room to develop the classic gradient: flames only
// climb a couple of rows above the source before dying, so a 6-row grid never
// gets past flat orange. Simulate DEPTH times as many rows and vertically
// sample the live flame band down to the display rows, keeping the full
// white-hot-to-ember arc and the ragged flickering tips.
const DEPTH = 4

// Heat values run 0..MAX, matching the 36-color palette of the original.
export const MAX = 35

// Upstream seeds no fire on grids narrower than 35 columns, so simulation
// width never drops below this. Coincidentally equal to MAX, but a separate
// concept: this is a column threshold, not the heat ceiling.
const MIN_WIDTH = 35

// Builds a 36-color fire ramp from a single base color so the flames match
// the active theme: embers stay near black, the body burns in shades of the
// base color, and the hottest cells blow out toward white. The eased splits
// mirror the shape of the classic DOOM ramp (long dark tail, short white
// core), which keeps dark bases like deep blue or green reading as fire.
export function palette(base: string): string[] {
  const n = parseInt(base.slice(1, 7), 16)
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const mix = (from: number[], to: number[], t: number) =>
    "#" +
    from
      .map((v, i) =>
        Math.round(v + (to[i] - v) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  return Array.from({ length: MAX + 1 }, (_, i) => {
    const t = i / MAX
    if (t < 0.55) return mix([7, 7, 7], rgb, Math.pow(t / 0.55, 1.3))
    return mix(rgb, [255, 255, 255], Math.pow((t - 0.55) / 0.45, 1.6))
  })
}

export interface Cell {
  char: string
  fg?: string
  bg?: string
}

interface Api {
  memory: WebAssembly.Memory
  fire_new(width: number, rows: number, heat: number): number
  fire_update_cells(ptr: number): void
  fire_get_cells(ptr: number): number
}

export interface Engine {
  advance(): void
  grid(): Uint8Array
}

let compiled: Promise<WebAssembly.Module> | undefined

// Caches the in-flight compilation so concurrent ignite() calls share one
// compile instead of racing to compile the module twice.
function module() {
  compiled ??= Bun.file(wasm)
    .bytes()
    .then((bytes) => new WebAssembly.Module(bytes))
  return compiled
}

// The grid is row-major with stride `width`: row 0 holds the ragged flame tips
// and row `rows - 1` is the constantly hot source hugging the chatbox.
export async function ignite(width: number, rows: number = ROWS): Promise<Engine> {
  const mod = await module()
  // Simulate at least MIN_WIDTH columns and slice each row down to the
  // requested width.
  const sim = Math.max(width, MIN_WIDTH)
  const depth = rows * DEPTH
  const spawn = () => {
    const instance = new WebAssembly.Instance(mod, {
      "./doom_fire": {
        __wbg_floor_12e75d22951301da: Math.floor,
        __wbg_random_ae55f5b83bdab2a0: Math.random,
        __wbindgen_throw: () => {
          throw new Error("doom-fire panic")
        },
      },
    })
    const api = instance.exports as unknown as Api
    return { api, ptr: api.fire_new(sim, depth, MAX) }
  }
  let state = spawn()
  // The flame body lives in the lower half of the tall grid; sample display
  // rows from just above it (occasional ragged tips) down to the source.
  const start = Math.floor(depth * 0.45)
  return {
    advance() {
      try {
        state.api.fire_update_cells(state.ptr)
      } catch {
        // Known upstream panic; a fresh instance reseeds and keeps burning.
        // If the respawn itself traps, keep the prior instance and retry on
        // the next advance instead of letting the error escape.
        try {
          state = spawn()
        } catch (err) {
          console.error("doom-fire respawn failed", { err })
        }
      }
    },
    // Reconstructed per read: the buffer detaches when wasm memory grows.
    grid() {
      const raw = new Uint8Array(state.api.memory.buffer, state.api.fire_get_cells(state.ptr), sim * depth)
      const out = new Uint8Array(width * rows)
      for (let y = 0; y < rows; y++) {
        const src = Math.round(start + (y * (depth - 1 - start)) / (rows - 1))
        out.set(raw.subarray(src * sim, src * sim + width), y * width)
      }
      return out
    },
  }
}

// Pairs vertically adjacent heat cells into one half-block character, so each
// text row carries two pixel rows and the fire renders as pixels instead of
// glyph soup. Zero heat stays transparent so the flame tips fade into the
// terminal background.
export function cell(top: number, bottom: number, colors: string[] = PALETTE): Cell {
  const paint = (heat: number) => colors[Math.min(colors.length - 1, Math.max(0, heat))]
  if (top === 0 && bottom === 0) return { char: " " }
  if (bottom === 0) return { char: "▀", fg: paint(top) }
  if (top === 0) return { char: "▄", fg: paint(bottom) }
  return { char: "▀", fg: paint(top), bg: paint(bottom) }
}

export function cells(grid: Uint8Array, width: number, colors: string[] = PALETTE): Cell[][] {
  const rows = width > 0 ? Math.floor(grid.length / width / 2) : 0
  return Array.from({ length: rows }, (_, y) =>
    Array.from({ length: width }, (_, x) => cell(grid[y * 2 * width + x], grid[(y * 2 + 1) * width + x], colors)),
  )
}
