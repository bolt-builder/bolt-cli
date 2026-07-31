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

export const GLYPHS = [" ", "·", "░", "▒", "▓", "█"]

// Red-dominant palette, dark ember to bright flame tip.
export const PALETTE = ["#1a0500", "#4a0e00", "#7f1500", "#b71c00", "#e53500", "#ff5a00", "#ff8c00", "#ffb84d"]

export const ROWS = 3

// Heat values run 0..MAX, matching the 36-color palette of the original.
export const MAX = 35

export interface Cell {
  char: string
  color: string
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

let compiled: WebAssembly.Module | undefined

async function module() {
  if (compiled) return compiled
  compiled = new WebAssembly.Module(await Bun.file(wasm).bytes())
  return compiled
}

// The grid is row-major with stride `width`: row 0 holds the ragged flame tips
// and row `rows - 1` is the constantly hot source hugging the chatbox.
export async function ignite(width: number, rows: number = ROWS): Promise<Engine> {
  const mod = await module()
  // Upstream seeds no fire on grids narrower than 35 columns, so simulate at
  // least that wide and slice each row down to the requested width.
  const sim = Math.max(width, MAX)
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
    return { api, ptr: api.fire_new(sim, rows, MAX) }
  }
  let state = spawn()
  return {
    advance() {
      try {
        state.api.fire_update_cells(state.ptr)
      } catch (err) {
        // Known upstream panic; a fresh instance reseeds and keeps burning.
        state = spawn()
      }
    },
    // Reconstructed per read: the buffer detaches when wasm memory grows.
    grid() {
      const raw = new Uint8Array(state.api.memory.buffer, state.api.fire_get_cells(state.ptr), sim * rows)
      if (sim === width) return raw
      const out = new Uint8Array(width * rows)
      for (let y = 0; y < rows; y++) out.set(raw.subarray(y * sim, y * sim + width), y * width)
      return out
    },
  }
}

export function cell(heat: number): Cell {
  const ratio = Math.min(1, Math.max(0, heat / MAX))
  const index = (() => {
    if (ratio < 0.05) return 0
    if (ratio < 0.15) return 1
    if (ratio < 0.35) return 2
    if (ratio < 0.6) return 3
    if (ratio < 0.85) return 4
    return 5
  })()
  const color = PALETTE[Math.min(PALETTE.length - 1, Math.floor(ratio * PALETTE.length))]
  return { char: GLYPHS[index], color }
}

export function cells(grid: Uint8Array, width: number): Cell[][] {
  const rows = width > 0 ? Math.floor(grid.length / width) : 0
  return Array.from({ length: rows }, (_, y) => Array.from(grid.subarray(y * width, (y + 1) * width), cell))
}
