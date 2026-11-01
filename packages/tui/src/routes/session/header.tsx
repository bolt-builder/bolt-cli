import { TextAttributes } from "@opentui/core"
import { createMemo, For, Show } from "solid-js"
import { useData } from "../../context/data"
import { useTheme } from "../../context/theme"
import { tint } from "../../theme/color"
import { Locale } from "../../util/locale"

const BRAND = "BOLT CLI"

// Three-line session header: a gradient brand row with a thin rule, the
// current session line, and a subagent activity line.
export function SessionHeader(props: { sessionID: string; width: number }) {
  const theme = useTheme()
  const data = useData()

  const session = createMemo(() => data.session.get(props.sessionID))
  const sessions = createMemo(() =>
    data.session.list().filter((x) => !x.parentID && x.projectID === session()?.projectID),
  )
  const subagents = createMemo(() => {
    const parentID = session()?.parentID ?? props.sessionID
    return data.session
      .list()
      .filter((x) => x.parentID === parentID)
      .toSorted((a, b) => a.time.created - b.time.created)
  })
  const working = (id: string) => data.session.status(id) !== "idle"

  const gradient = (column: number) => tint(theme.brand.accent, theme.brand.primary, column / (BRAND.length - 1))

  const label = (title: string, max: number) => {
    const name = title.match(/@(\w+) subagent/)?.[1]
    const text = name ? Locale.titlecase(name) : title
    return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text
  }

  return (
    <box flexShrink={0} paddingTop={1}>
      <box flexDirection="row" gap={1} overflow="hidden">
        <text selectable={false}>
          {Array.from(BRAND).map((char, column) => (
            <span style={{ fg: gradient(column), attributes: TextAttributes.BOLD }}>{char}</span>
          ))}
        </text>
        <text fg={theme.border.base} selectable={false} wrapMode="none">
          {"─".repeat(Math.max(0, props.width - BRAND.length - 1))}
        </text>
      </box>
      <box flexDirection="row" gap={1} overflow="hidden">
        <text fg={theme.brand.primary}>●</text>
        <text fg={theme.text.base} wrapMode="none" truncate flexShrink={1}>
          {label(session()?.title ?? "untitled", Math.max(8, props.width - 20))}
        </text>
        <text fg={theme.text.muted} wrapMode="none">
          · {sessions().length} {sessions().length === 1 ? "session" : "sessions"}
        </text>
      </box>
      <Show
        when={subagents().length > 0}
        fallback={
          <text fg={theme.text.muted} wrapMode="none">
            no subagent work
          </text>
        }
      >
        <box flexDirection="row" gap={2}>
          <For each={subagents().slice(-3)}>
            {(child) => (
              <box flexDirection="row" gap={1}>
                <text fg={working(child.id) ? theme.text.feedback.success.base : theme.text.muted}>
                  {working(child.id) ? "◉" : "○"}
                </text>
                <text fg={working(child.id) ? theme.text.base : theme.text.muted} wrapMode="none">
                  {label(child.title ?? "untitled", 24)}
                </text>
              </box>
            )}
          </For>
          <Show when={subagents().length > 3}>
            <text fg={theme.text.muted}>+{subagents().length - 3} more</text>
          </Show>
        </box>
      </Show>
    </box>
  )
}
