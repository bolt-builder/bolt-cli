export interface Signal {
  hot?: boolean
  failing?: boolean
}

// Rank file suggestions: files with failing diagnostics first, then hot files
// (locally modified), then everything else. The sort is stable so the
// caller's relevance order is preserved within each tier.
export function rank(input: { paths: string[]; signals: Record<string, Signal> }) {
  const score = (file: string) => {
    const signal = input.signals[file]
    if (!signal) return 0
    return (signal.failing ? 2 : 0) + (signal.hot ? 1 : 0)
  }
  return input.paths
    .map((file, index) => ({ file, index, score: score(file) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.file)
}

export * as FileRank from "./rank"
