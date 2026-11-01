import { RGBA, TextAttributes } from "@opentui/core"
import { For, type JSX } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "../context/theme"
import { compact, logo } from "../logo"

export function Logo() {
  const theme = useTheme()
  const dimensions = useTerminalDimensions()

  const leftWidth = Math.max(...logo.left.map((line) => line.length))
  const rightWidth = Math.max(...logo.right.map((line) => line.length))

  const renderLine = (line: string, fg: RGBA, bold: boolean): JSX.Element[] => {
    const attrs = bold ? TextAttributes.BOLD : undefined
    return Array.from(line).map((char) => {
      return (
        <text fg={fg} attributes={attrs} selectable={false}>
          {char}
        </text>
      )
    })
  }

  return (
    <box>
      {dimensions().height < 12 ? null : dimensions().width < leftWidth ||
        (dimensions().width < leftWidth + rightWidth + 1 &&
          dimensions().height < logo.left.length + logo.right.length) ? (
        <For each={compact}>{(line) => <box flexDirection="row">{renderLine(line, theme.text.base, true)}</box>}</For>
      ) : dimensions().width < leftWidth + rightWidth + 1 ? (
        <>
          <For each={logo.left}>
            {(line) => <box flexDirection="row">{renderLine(line, theme.text.muted, false)}</box>}
          </For>
          <For each={logo.right}>
            {(line) => <box flexDirection="row">{renderLine(line, theme.text.base, true)}</box>}
          </For>
        </>
      ) : (
        <For each={logo.left}>
          {(line, index) => (
            <box flexDirection="row" gap={1}>
              <box flexDirection="row">{renderLine(line, theme.text.muted, false)}</box>
              <box flexDirection="row">{renderLine(logo.right[index()] ?? "", theme.text.base, true)}</box>
            </box>
          )}
        </For>
      )}
    </box>
  )
}
