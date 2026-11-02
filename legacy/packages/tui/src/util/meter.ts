export const WIDTH = 5

// Render a compact block meter for a 0-100 percentage, e.g. 45% -> "▰▰▰▱▱"
// at the default width. Values are clamped so overflow never breaks layout.
export function meter(percent: number, width = WIDTH) {
  const clamped = Math.min(100, Math.max(0, percent))
  const filled = Math.round((clamped / 100) * width)
  return "▰".repeat(filled) + "▱".repeat(width - filled)
}
