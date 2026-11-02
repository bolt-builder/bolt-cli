export const BUDGET = 20_000

export interface Hunk {
  header: string
  lines: string[]
}

// Parse a unified diff into hunks, dropping the file header lines. Each hunk
// keeps its @@ header so line positions stay visible to the model.
export function parse(patch: string) {
  const hunks: Hunk[] = []
  for (const line of patch.split("\n")) {
    if (line.startsWith("@@")) {
      hunks.push({ header: line, lines: [] })
      continue
    }
    const current = hunks.at(-1)
    if (!current) continue
    current.lines.push(line)
  }
  return hunks
}

// Keep hunks in order until the character budget is exhausted. A hunk that
// does not fit is dropped so later, smaller hunks can still make it.
export function select(input: { hunks: Hunk[]; budget: number }) {
  let used = 0
  return input.hunks.filter((hunk) => {
    const size = hunk.header.length + hunk.lines.reduce((total, line) => total + line.length + 1, 0)
    if (used + size > input.budget) return false
    used += size
    return true
  })
}

export function render(input: { file: string; hunks: Hunk[]; total: number }) {
  const dropped = input.total - input.hunks.length
  const body = input.hunks.map((hunk) => [hunk.header, ...hunk.lines].join("\n")).join("\n")
  const note = dropped > 0 ? `\n[${dropped} more hunk${dropped === 1 ? "" : "s"} omitted]` : ""
  return `Changed hunks in ${input.file} (diff against HEAD):\n${body}${note}`
}

export * as SessionHunk from "./hunk"
