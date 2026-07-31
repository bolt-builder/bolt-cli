import { createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { useLocal } from "../context/local"
import { useRoute } from "../context/route"
import { useSync } from "../context/sync"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { Locale } from "../util/locale"
import { DialogSessionList } from "./dialog-session-list"
import { Spinner } from "./spinner"

// Recent top-level sessions with live busy indicators. Rendered inside the
// home sidebar panel and the session sidebar's Sessions section.
export function SessionSidebarList(props: { limit?: number }) {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  const local = useLocal()
  const dialog = useDialog()
  const limit = () => props.limit ?? 15

  // Coarse ticker so relative timestamps stay fresh.
  const [now, setNow] = createSignal(Date.now())
  const timer = setInterval(() => setNow(Date.now()), 30000)
  onCleanup(() => clearInterval(timer))

  const current = createMemo(() => (route.data.type === "session" ? route.data.sessionID : undefined))
  const ordered = createMemo(() => {
    const pinned = local.session.pinned()
    const pinnedSet = new Set(pinned)
    const roots = sync.data.session.filter((x) => !x.parentID)
    const byID = new Map(roots.map((x) => [x.id, x]))
    const rest = roots.filter((x) => !pinnedSet.has(x.id)).toSorted((a, b) => b.time.updated - a.time.updated)
    return [...pinned.flatMap((id) => (byID.has(id) ? [byID.get(id)!] : [])), ...rest]
  })
  const visible = createMemo(() => ordered().slice(0, limit()))
  const hidden = createMemo(() => Math.max(0, ordered().length - limit()))
  const slotByID = createMemo(() => new Map(local.session.slots().map((id, index) => [id, index + 1])))

  const busy = (id: string) => {
    const status = sync.data.session_status?.[id]
    return status?.type === "busy" || status?.type === "retry"
  }

  const [hover, setHover] = createSignal<string>()

  return (
    <box>
      <box flexDirection="row" gap={1}>
        <text fg={theme.text}>
          <b>Sessions</b>
        </text>
        <text fg={theme.textMuted}>{ordered().length}</text>
      </box>
      <For each={visible()}>
        {(item) => (
          <box
            flexDirection="row"
            gap={1}
            onMouseOver={() => setHover(item.id)}
            onMouseOut={() => setHover(undefined)}
            onMouseDown={() => route.navigate({ type: "session", sessionID: item.id })}
            backgroundColor={hover() === item.id ? theme.backgroundElement : undefined}
          >
            <Show
              when={busy(item.id)}
              fallback={
                <Show
                  when={slotByID().get(item.id)}
                  fallback={
                    <text fg={item.id === current() ? theme.primary : theme.textMuted}>
                      {item.id === current() ? "●" : "○"}
                    </text>
                  }
                >
                  {(slot) => <text fg={theme.accent}>{slot()}</text>}
                </Show>
              }
            >
              <Spinner />
            </Show>
            <text
              fg={item.id === current() ? theme.text : theme.textMuted}
              wrapMode="none"
              flexShrink={1}
              flexGrow={1}
              truncate
            >
              {item.id === current() ? <b>{item.title}</b> : item.title}
            </text>
            <text fg={theme.textMuted} flexShrink={0}>
              {(now(), Locale.relative(item.time.updated))}
            </text>
          </box>
        )}
      </For>
      <Show when={ordered().length === 0}>
        <text fg={theme.textMuted}>no sessions yet</text>
      </Show>
      <Show when={hidden() > 0}>
        <box flexDirection="row" gap={1} onMouseDown={() => dialog.replace(() => <DialogSessionList />)}>
          <text fg={theme.textMuted}>
            {hidden()} more · <span style={{ fg: theme.accent }}>/sessions</span>
          </text>
        </box>
      </Show>
    </box>
  )
}

// Standalone 42-column sidebar panel for the home screen.
export function SessionSidebar(props: { overlay?: boolean }) {
  const { theme } = useTheme()

  return (
    <box
      backgroundColor={theme.backgroundPanel}
      width={42}
      height="100%"
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
      position={props.overlay ? "absolute" : "relative"}
    >
      <scrollbox
        flexGrow={1}
        verticalScrollbarOptions={{
          trackOptions: {
            backgroundColor: theme.background,
            foregroundColor: theme.borderActive,
          },
        }}
      >
        <box flexShrink={0} paddingRight={1}>
          <SessionSidebarList />
        </box>
      </scrollbox>
    </box>
  )
}
