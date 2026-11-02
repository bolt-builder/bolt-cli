import { RGBA } from "@opentui/core"
import { logo } from "../logo"
import { tint } from "../theme/color"

const reset = "\x1b[0m"
const bold = "\x1b[1m"
const dim = "\x1b[90m"

type Brand = { readonly primary: string; readonly accent: string }

function wordmark(pad = "", brand: Brand = { primary: "#2d7bff", accent: "#63d9ff" }) {
  const left = RGBA.fromHex(brand.accent)
  const right = RGBA.fromHex(brand.primary)
  const width =
    Math.max(...logo.left.map((line) => line.length)) + Math.max(...logo.right.map((line) => line.length)) + 1
  return logo.left.map(
    (line, index) =>
      pad +
      Array.from(`${line} ${logo.right[index] ?? ""}`)
        .map((char, column) => {
          const color = tint(left, right, column / Math.max(1, width - 1))
          return `\x1b[38;2;${Math.round(color.r * 255)};${Math.round(color.g * 255)};${Math.round(color.b * 255)}m${char}`
        })
        .join("") +
      reset,
  )
}

export type SessionEpilogue = { readonly title: string; readonly sessionID?: string; readonly brand?: Brand }

// Printed after the TUI closes.
export function epilogue(input: { readonly session?: SessionEpilogue; readonly updatedVersion?: string }) {
  if (!input.session && !input.updatedVersion) return
  const row = (label: string, value: string) => `  ${dim}${label.padEnd(10, " ")}${reset}${bold}${value}${reset}`
  return [
    ...wordmark("  ", input.session?.brand),
    "",
    ...(input.updatedVersion
      ? [`  ${dim}Run ${reset}${bold}bolt${reset}${dim} to use ${reset}${bold}${input.updatedVersion}${reset}`, ""]
      : []),
    ...(input.session
      ? [row("Session", input.session.title), row("Continue", `bolt -s ${input.session.sessionID}`), ""]
      : []),
  ].join("\n")
}
