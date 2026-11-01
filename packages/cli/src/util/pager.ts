import { EOL } from "os"

/** Resolve the pager command line: $PAGER, falling back to `less -R`. */
export function command() {
  const pager = process.env.PAGER?.trim()
  if (pager) return pager
  return "less -R"
}

/** True when the text, with long lines wrapped at the terminal width, needs more rows than the terminal can show. */
export function overflows(text: string, rows: number, columns: number) {
  const lines = text.split("\n")
  if (text.endsWith("\n")) lines.pop()
  return lines.reduce((total, line) => total + Math.max(1, Math.ceil(Bun.stringWidth(line) / columns)), 0) > rows
}

/**
 * Print text to stdout, paging through $PAGER when it is longer than the
 * terminal. Non-TTY stdout (pipes, redirects) always prints directly so
 * scripted output never blocks on a pager.
 */
export async function page(text: string) {
  if (!text) return
  const body = text.endsWith("\n") ? text : text + EOL
  if (
    !process.stdout.isTTY ||
    process.platform === "win32" ||
    !overflows(body, process.stdout.rows || 24, process.stdout.columns || 80)
  ) {
    process.stdout.write(body)
    return
  }
  const proc = Bun.spawn(["sh", "-c", command()], { stdin: "pipe", stdout: "inherit", stderr: "inherit" })
  proc.stdin.write(body)
  await proc.stdin.end()
  await proc.exited
}

export * as Pager from "./pager"
