import { EOL } from "os"
import { Schema } from "effect"
import { logo as glyphs } from "./logo"

// Gradient endpoints for the wordmark, matching the bolt theme's accent
// (#63d9ff) and primary (#2d7bff) colors.
const GRADIENT_FROM = [0x63, 0xd9, 0xff] as const
const GRADIENT_TO = [0x2d, 0x7b, 0xff] as const

export class CancelledError extends Schema.TaggedErrorClass<CancelledError>()("UICancelledError", {}) {}

export const Style = {
  TEXT_HIGHLIGHT: "\x1b[96m",
  TEXT_HIGHLIGHT_BOLD: "\x1b[96m\x1b[1m",
  TEXT_DIM: "\x1b[90m",
  TEXT_DIM_BOLD: "\x1b[90m\x1b[1m",
  TEXT_NORMAL: "\x1b[0m",
  TEXT_NORMAL_BOLD: "\x1b[1m",
  TEXT_WARNING: "\x1b[93m",
  TEXT_WARNING_BOLD: "\x1b[93m\x1b[1m",
  TEXT_DANGER: "\x1b[91m",
  TEXT_DANGER_BOLD: "\x1b[91m\x1b[1m",
  TEXT_SUCCESS: "\x1b[92m",
  TEXT_SUCCESS_BOLD: "\x1b[92m\x1b[1m",
  TEXT_INFO: "\x1b[94m",
  TEXT_INFO_BOLD: "\x1b[94m\x1b[1m",
}

export function println(...message: string[]) {
  print(...message)
  process.stderr.write(EOL)
}

export function print(...message: string[]) {
  blank = false
  process.stderr.write(message.join(" "))
}

let blank = false
export function empty() {
  if (blank) return
  println("" + Style.TEXT_NORMAL)
  blank = true
}

export function logo(pad?: string) {
  const rows = glyphs.wordmark
  if (!process.stdout.isTTY && !process.stderr.isTTY) {
    return rows.map((row) => (pad ?? "") + row).join(EOL)
  }

  const reset = "\x1b[0m"
  const fg = (rgb: readonly [number, number, number]) => `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`
  const mix = (t: number) =>
    [0, 1, 2].map((i) => Math.round(GRADIENT_FROM[i]! + (GRADIENT_TO[i]! - GRADIENT_FROM[i]!) * t)) as unknown as [
      number,
      number,
      number,
    ]
  const field = fg([0x1e, 0x3a, 0x5f])
  const width = rows[0]!.length

  const result: string[] = []
  rows.forEach((row, index) => {
    if (pad) result.push(pad)
    result.push(field, "╱".repeat(6), reset, " ")
    Array.from(row).forEach((char, column) => {
      if (char === " ") {
        result.push(" ")
        return
      }
      result.push(fg(mix(column / (width - 1))), char)
    })
    result.push(reset, " ", field, "╱".repeat(15 - index), reset)
    result.push(EOL)
  })
  return result.join("").trimEnd()
}

export async function input(prompt: string): Promise<string> {
  const readline = require("readline")
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export function error(message: string) {
  if (message.startsWith("Error: ")) {
    message = message.slice("Error: ".length)
  }
  println(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message)
}

export function markdown(text: string): string {
  return text
}

export * as UI from "./ui"
