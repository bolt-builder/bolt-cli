export interface Warning {
  subject: string
  first: string
  second: string
}

export const THRESHOLD = 0.5

const NEGATIVE = /\b(never|do not|don't|must not|avoid)\b/i
const POSITIVE = /\b(always|must|prefer|use)\b/i
const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "when",
  "are",
  "this",
  "that",
  "you",
  "your",
  "all",
  "any",
  "not",
  "never",
  "always",
  "must",
  "avoid",
  "prefer",
  "use",
  "using",
  "should",
  "instead",
  "unless",
  "please",
])

type Directive = {
  text: string
  negative: boolean
  subject: Set<string>
}

function words(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[`"'().,:;!?*_]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP.has(word)),
  )
}

function directives(section: string): Directive[] {
  return section.split("\n").flatMap((line) => {
    const text = line.replace(/^[-*>\d.\s]+/, "").trim()
    if (!text) return []
    const negative = NEGATIVE.test(text)
    const positive = !negative && POSITIVE.test(text)
    if (!negative && !positive) return []
    const subject = words(text)
    // A directive needs enough subject words to compare meaningfully.
    if (subject.size < 2) return []
    return [{ text, negative, subject }]
  })
}

function overlap(a: Set<string>, b: Set<string>) {
  const smaller = a.size <= b.size ? a : b
  const larger = a.size <= b.size ? b : a
  let shared = 0
  for (const word of smaller) if (larger.has(word)) shared++
  return smaller.size ? shared / smaller.size : 0
}

// Flag pairs of directives with opposite polarity (always/use/prefer versus
// never/do not/avoid) whose subjects overlap heavily. Heuristic by design:
// it catches the common case of one instruction file contradicting another,
// not every semantic conflict.
export function lint(sections: string[]) {
  const all = sections.flatMap(directives)
  const warnings: Warning[] = []
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]
      const b = all[j]
      if (a.negative === b.negative) continue
      if (overlap(a.subject, b.subject) < THRESHOLD) continue
      const shared = [...a.subject].filter((word) => b.subject.has(word))
      warnings.push({ subject: shared.join(" "), first: a.text, second: b.text })
    }
  }
  return warnings
}

export * as SessionLint from "./lint"
