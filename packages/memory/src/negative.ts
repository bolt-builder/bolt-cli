/** Negative memory: remember what did NOT work so future sessions stop repeating it. Failed
 * approaches live in project.md under a dedicated section and read as explicit warnings. */
export const SECTION = "Failed Approaches"

const PREFIX = "did not work:"

const MARKED = /\b(did not work|does not work|didn'?t work|doesn'?t work|failed|broke|breaks)\b/i

/** Normalize a failed approach into a self-contained warning line. Text that already states the
 * failure keeps its phrasing; bare descriptions get the explicit prefix. */
export function text(input: { approach: string; outcome?: string }) {
  const approach = input.approach.trim().replace(/[.\s]+$/, "")
  const outcome = input.outcome?.trim().replace(/[.\s]+$/, "")
  const base = MARKED.test(approach) ? approach : `${PREFIX} ${approach}`
  return outcome ? `${base} (${outcome}).` : `${base}.`
}

/** Whether a stored entry is a negative memory, by section or by failure phrasing. */
export function is(input: { section?: string; text: string }) {
  if (input.section?.trim().toLowerCase() === SECTION.toLowerCase()) return true
  return input.text.toLowerCase().startsWith(PREFIX)
}

export * as MemoryNegative from "./negative"
