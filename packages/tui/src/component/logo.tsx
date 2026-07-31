import { For } from "solid-js"
import { tint, useTheme } from "../context/theme"
import { logo } from "../logo"

const DIAG = "╱"
const LEFT_FIELD_WIDTH = 6
const RIGHT_FIELD_WIDTH = 15

export function Logo() {
  const { theme } = useTheme()
  const width = logo.wordmark[0]?.length ?? 1

  // Per-column horizontal gradient across the wordmark, secondary to primary.
  const gradient = (column: number) => tint(theme.secondary, theme.primary, width <= 1 ? 1 : column / (width - 1))

  return (
    <box>
      <For each={logo.wordmark}>
        {(line, row) => (
          <box flexDirection="row">
            <text fg={theme.primary} selectable={false}>
              {DIAG.repeat(LEFT_FIELD_WIDTH) + " "}
            </text>
            {Array.from(line).map((char, column) => (
              <text fg={gradient(column)} selectable={false}>
                {char}
              </text>
            ))}
            {/* The right field steps down one cell per row, like a wind-swept flag. */}
            <text fg={theme.primary} selectable={false}>
              {" " + DIAG.repeat(RIGHT_FIELD_WIDTH - row())}
            </text>
          </box>
        )}
      </For>
    </box>
  )
}
