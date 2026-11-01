import { logo } from "../logo"

const reset = "\x1b[0m"
const bold = "\x1b[1m"
const dim = "\x1b[90m"

function wordmark(pad = "") {
  return logo.left.map((line, index) => `${pad}${dim}${line}${reset} ${logo.right[index] ?? ""}`)
}

export type SessionEpilogue = { readonly title: string; readonly sessionID?: string }

// Printed after the TUI closes.
export function epilogue(input: { readonly session?: SessionEpilogue; readonly updatedVersion?: string }) {
  if (!input.session && !input.updatedVersion) return
  const row = (label: string, value: string) => `  ${dim}${label.padEnd(10, " ")}${reset}${bold}${value}${reset}`
  return [
    ...wordmark("  "),
    "",
    ...(input.updatedVersion
      ? [`  ${dim}Run ${reset}${bold}bolt${reset}${dim} to use ${reset}${bold}${input.updatedVersion}${reset}`, ""]
      : []),
    ...(input.session
      ? [row("Session", input.session.title), row("Continue", `bolt -s ${input.session.sessionID}`), ""]
      : []),
  ].join("\n")
}
