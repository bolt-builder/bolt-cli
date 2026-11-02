import { TextAttributes } from "@opentui/core"
import { For, type JSX } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "../context/theme"
import { compact, logo } from "../logo"
import { tint } from "../theme/color"

export function Logo() {
  const theme = useTheme()
  const dimensions = useTerminalDimensions()

  const leftWidth = Math.max(...logo.left.map((line) => line.length))
  const rightWidth = Math.max(...logo.right.map((line) => line.length))

  const gradient = (column: number, width = leftWidth + rightWidth + 1) =>
    tint(theme.brand.accent, theme.brand.primary, column / Math.max(1, width - 1))

  const renderLine = (line: string, offset: number, bold: boolean, width?: number): JSX.Element[] => {
    const attrs = bold ? TextAttributes.BOLD : undefined
    return Array.from(line).map((char, column) => {
      return (
        <text fg={gradient(offset + column, width)} attributes={attrs} selectable={false}>
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
        <For each={compact}>
          {(line) => <box flexDirection="row">{renderLine(line, 0, true, compact[0].length)}</box>}
        </For>
      ) : dimensions().width < leftWidth + rightWidth + 1 ? (
        <>
          <For each={logo.left}>{(line) => <box flexDirection="row">{renderLine(line, 0, false)}</box>}</For>
          <For each={logo.right}>
            {(line) => <box flexDirection="row">{renderLine(line, leftWidth + 1, true)}</box>}
          </For>
        </>
      ) : (
        <For each={logo.left}>
          {(line, index) => (
            <box flexDirection="row" gap={1}>
              <box flexDirection="row">{renderLine(line, 0, false)}</box>
              <box flexDirection="row">{renderLine(logo.right[index()] ?? "", leftWidth + 1, true)}</box>
            </box>
          )}
        </For>
      )}
    </box>
  )
}
