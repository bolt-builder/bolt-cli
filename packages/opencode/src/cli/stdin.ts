/** Normalize raw piped input: whitespace-only input counts as no input. */
export function normalize(text: string) {
  if (!text.trim()) return undefined
  return text
}

/**
 * Read piped stdin once so commands can inject it as context, e.g.
 * `git diff | bolt review` or `pbpaste | bolt run "fix this"`.
 * Returns undefined when stdin is an interactive terminal.
 */
export async function piped() {
  if (process.stdin.isTTY) return undefined
  return normalize(await Bun.stdin.text())
}

export * as Stdin from "./stdin"
