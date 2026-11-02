import { EOL } from "os"
import { Schema } from "effect"
import { logo as glyphs } from "./logo"

// Gradient endpoints for the wordmark, matching the bolt theme's accent
// (#63d9ff) and primary (#2d7bff) colors.
const GRADIENT_FROM = [0x63, 0xd9, 0xff] as const
const GRADIENT_TO = [0x2d, 0x7b, 0xff] as const

export class CancelledError extends Schema.TaggedErrorClass<CancelledError>()("UICancelledError", {}) {}

// Suppresses non-essential stderr chatter (print/println); errors always print.
let quiet = false
export function setQuiet(value: boolean) {
  quiet = value
}

/** Honor https://no-color.org: any non-empty NO_COLOR value disables ANSI colors. */
export function colors() {
  return !process.env.NO_COLOR
}

/** Remove ANSI color/style sequences from a string. */
export function strip(text: string) {
  return text.replaceAll(/\x1b\[[0-9;]*m/g, "")
}

function render(message: string[]) {
  const text = message.join(" ")
  if (colors()) return text
  return strip(text)
}

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
  if (quiet) return
  print(...message)
  process.stderr.write(EOL)
}

export function print(...message: string[]) {
  if (quiet) return
  blank = false
  process.stderr.write(render(message))
}

let blank = false
export function empty() {
  if (blank) return
  println("" + Style.TEXT_NORMAL)
  blank = true
}

export function logo(pad?: string) {
  const leftWidth = glyphs.left[0].length
  const totalWidth = leftWidth + 1 + glyphs.right[0].length

  if (!colors() || (!process.stdout.isTTY && !process.stderr.isTTY)) {
    return glyphs.left.map((row, index) => `${pad ?? ""}${row} ${glyphs.right[index] ?? ""}`).join(EOL)
  }

  const reset = "\x1b[0m"
  const shadow = "\x1b[38;5;236m"
  const color = (rgb: readonly number[]) => `\x1b[38;2;${rgb.join(";")}m`
  const gradient = (column: number) => {
    const ratio = column / (totalWidth - 1)
    return color(GRADIENT_FROM.map((from, channel) => Math.round(from + (GRADIENT_TO[channel] - from) * ratio)))
  }

  const draw = (line: string, offset: number, bold: boolean) => {
    const parts: string[] = []
    Array.from(line).forEach((char, column) => {
      if (char === " ") {
        parts.push(" ")
        return
      }
      if (char === "_") {
        parts.push(shadow, "_", reset)
        return
      }
      parts.push(gradient(offset + column), bold ? "\x1b[1m" : "", char, reset)
    })
    return parts.join("")
  }

  const result: string[] = []
  glyphs.left.forEach((row, index) => {
    if (pad) result.push(pad)
    result.push(draw(row, 0, false))
    result.push(" ")
    result.push(draw(glyphs.right[index] ?? "", leftWidth + 1, true))
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
  // Errors bypass --quiet: write directly instead of going through println.
  blank = false
  process.stderr.write(render([Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message]) + EOL)
}

export function markdown(text: string): string {
  return text
}

export * as UI from "./ui"
