import { TextAttributes } from "@opentui/core"
import { For, Show, type JSX } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { tint, useTheme } from "../context/theme"
import { logo } from "../logo"

const BRAND = "BOLT CLI"

export function Logo() {
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()

  const leftWidth = logo.left[0]?.length ?? 0
  const totalWidth = leftWidth + 1 + (logo.right[0]?.length ?? 0)

  // The big art clips below ~80 columns; fall back to a one-line brand row.
  const compact = () => dimensions().width < totalWidth + 4

  // Horizontal gradient across the whole wordmark, accent to primary.
  const gradient = (column: number) =>
    tint(theme.accent, theme.primary, totalWidth <= 1 ? 1 : column / (totalWidth - 1))

  const renderLine = (line: string, offset: number, bold: boolean): JSX.Element[] => {
    const attrs = bold ? TextAttributes.BOLD : undefined
    return Array.from(line).map((char, column) => {
      const fg = gradient(offset + column)
      const shadow = tint(theme.background, fg, 0.25)
      if (char === "_") {
        return (
          <text fg={fg} bg={shadow} attributes={attrs} selectable={false}>
            {" "}
          </text>
        )
      }
      if (char === "^") {
        return (
          <text fg={fg} bg={shadow} attributes={attrs} selectable={false}>
            ▀
          </text>
        )
      }
      if (char === "~") {
        return (
          <text fg={shadow} attributes={attrs} selectable={false}>
            ▀
          </text>
        )
      }
      if (char === ",") {
        return (
          <text fg={shadow} attributes={attrs} selectable={false}>
            ▄
          </text>
        )
      }
      return (
        <text fg={fg} attributes={attrs} selectable={false}>
          {char}
        </text>
      )
    })
  }

  return (
    <Show
      when={!compact()}
      fallback={
        <text selectable={false}>
          {Array.from(BRAND).map((char, column) => (
            <span
              style={{
                fg: tint(theme.accent, theme.primary, column / (BRAND.length - 1)),
                attributes: TextAttributes.BOLD,
              }}
            >
              {char}
            </span>
          ))}
        </text>
      }
    >
      <box>
        <For each={logo.left}>
          {(line, index) => (
            <box flexDirection="row" gap={1}>
              <box flexDirection="row">{renderLine(line, 0, false)}</box>
              {/* Safely access logo.right with fallback to empty string */}
              <box flexDirection="row">{renderLine(logo.right[index()] ?? "", leftWidth + 1, true)}</box>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
