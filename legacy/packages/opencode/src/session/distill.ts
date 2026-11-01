import type { Provider } from "@/provider/provider"
import { Token } from "@/util/token"

export const SMALL_CONTEXT = 60_000
export const SYSTEM_RATIO = 0.25
export const TOOL_OUTPUT_MAX_CHARS = 4_000

// Models with a small context window get distilled context automatically:
// optional system sections are dropped once they blow the system budget and
// old tool outputs are truncated harder during message conversion.
export function small(model: Provider.Model) {
  return model.limit.context > 0 && model.limit.context < SMALL_CONTEXT
}

// Greedy selection: required sections always survive, optional sections are
// added in priority order while the estimated system size stays within
// SYSTEM_RATIO of the context window. Oversized sections are skipped so a
// smaller, later section can still fit.
export function select(input: { context: number; required: string[]; optional: string[] }) {
  const budget = input.context * SYSTEM_RATIO
  const sections = [...input.required]
  for (const section of input.optional) {
    if (Token.estimate([...sections, section].join("\n\n")) > budget) continue
    sections.push(section)
  }
  return sections
}

export function options(model: Provider.Model) {
  if (!small(model)) return undefined
  return { toolOutputMaxChars: TOOL_OUTPUT_MAX_CHARS }
}

export * as SessionDistill from "./distill"
