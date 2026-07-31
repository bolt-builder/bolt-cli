// Heat simulation for the animated fire border around the chatbox.
// Pure logic only; rendering lives in component/fire-frame.tsx.

export const GLYPHS = [" ", "·", "▁", "▂", "▃", "▄", "▅", "▆"]

// Red-dominant palette, dark ember to bright flame tip.
export const PALETTE = ["#3a0a00", "#6e1400", "#a51e00", "#d92600", "#ff3d00", "#ff6a00", "#ff9433", "#ffc266"]

export interface Cell {
  char: string
  color: string
}

export function seed(width: number): number[] {
  return Array.from({ length: Math.max(0, width) }, () => 0)
}

export function advance(heat: number[], rng: () => number = Math.random): number[] {
  return heat.map((value, index) => {
    const left = heat[index - 1] ?? value
    const right = heat[index + 1] ?? value
    const mixed = (left + right + value * 2) / 4
    const cooled = mixed * (0.72 + rng() * 0.2)
    const sparked = rng() < 0.22 ? Math.min(1, cooled + 0.35 + rng() * 0.65) : cooled
    return Math.min(1, Math.max(0, sparked))
  })
}

export function cell(heat: number): Cell {
  const index = Math.min(GLYPHS.length - 1, Math.floor(heat * GLYPHS.length))
  return { char: GLYPHS[index], color: PALETTE[Math.min(index, PALETTE.length - 1)] }
}

export function cells(heat: number[]): Cell[] {
  return heat.map(cell)
}

export function side(heat: number[]): string {
  if (heat.length === 0) return PALETTE[4]
  const mean = heat.reduce((sum, value) => sum + value, 0) / heat.length
  const index = Math.min(PALETTE.length - 1, 3 + Math.floor(mean * 4))
  return PALETTE[index]
}
