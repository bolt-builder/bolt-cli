// DOOM-style fire simulation for the animated fire border around the chatbox.
// Pure logic only; rendering lives in component/fire-frame.tsx.
//
// The grid is oriented source-last: grid[rows - 1] is the constantly hot source
// row (the edge touching the chatbox) and grid[0] holds the ragged flame tips.
// Callers render the grid as-is for flames pointing up (top strip) and reversed
// for flames pointing down (bottom strip), so the fire always faces outward.

export const GLYPHS = [" ", "·", "░", "▒", "▓", "█"]

// Red-dominant palette, dark ember to bright flame tip.
export const PALETTE = ["#1a0500", "#4a0e00", "#7f1500", "#b71c00", "#e53500", "#ff5a00", "#ff8c00", "#ffb84d"]

export const ROWS = 3

export interface Cell {
  char: string
  color: string
}

export function seed(width: number, rows: number = ROWS): number[][] {
  const cols = Math.max(0, width)
  return Array.from({ length: Math.max(1, rows) }, (_, y) =>
    Array.from({ length: cols }, () => (y === Math.max(1, rows) - 1 ? 1 : 0)),
  )
}

export function advance(grid: number[][], rng: () => number = Math.random): number[][] {
  const rows = grid.length
  const width = grid[0]?.length ?? 0
  return grid.map((row, y) => {
    // Source row: stays near max heat with a subtle flicker.
    if (y === rows - 1) return row.map(() => 0.85 + rng() * 0.15)
    // Every other row pulls heat from below with lateral drift and decay,
    // which is what produces the ragged, licking flame tips.
    return row.map((_, x) => {
      const drift = Math.floor(rng() * 3) - 1
      const source = grid[y + 1][Math.min(width - 1, Math.max(0, x + drift))] ?? 0
      const decay = rng() * 0.55
      return Math.max(0, source - decay)
    })
  })
}

export function cell(heat: number): Cell {
  const index = (() => {
    if (heat < 0.05) return 0
    if (heat < 0.15) return 1
    if (heat < 0.35) return 2
    if (heat < 0.6) return 3
    if (heat < 0.85) return 4
    return 5
  })()
  const color = PALETTE[Math.min(PALETTE.length - 1, Math.floor(heat * PALETTE.length))]
  return { char: GLYPHS[index], color }
}

export function cells(grid: number[][]): Cell[][] {
  return grid.map((row) => row.map(cell))
}

export function side(grid: number[][]): string {
  const source = grid[grid.length - 1] ?? []
  if (source.length === 0) return PALETTE[5]
  const mean = source.reduce((sum, value) => sum + value, 0) / source.length
  const index = Math.min(PALETTE.length - 1, 4 + Math.floor(mean * 3))
  return PALETTE[index]
}
