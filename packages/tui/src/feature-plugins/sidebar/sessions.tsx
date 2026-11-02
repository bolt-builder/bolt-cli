import { Plugin } from "@opencode/plugin/tui"
import type { SessionInfo } from "@opencode/client"
import { createMemo, For, onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { withTimestampedFallback } from "@opencode/util/session-title-fallback"
import { Keymap } from "../../context/keymap"

function SidebarSessions(props: { context: Plugin.Context; sessionID: string }) {
  const context = props.context
  const keymap = Keymap.use()
  const controller = new AbortController()
  const [state, setState] = createStore({
    sessions: [] as SessionInfo[],
    cursor: undefined as string | undefined,
    loading: false,
    error: false,
  })
  const load = async () => {
    if (state.loading) return
    setState({ loading: true, error: false })
    try {
      const result = await context.client.session.list(
        { parentID: null, limit: 25, ...(state.cursor ? { cursor: state.cursor } : { order: "desc" }) },
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      setState({ sessions: [...state.sessions, ...result.data], cursor: result.cursor.next ?? undefined })
    } catch {
      if (!controller.signal.aborted) setState("error", true)
    } finally {
      if (!controller.signal.aborted) setState("loading", false)
    }
  }
  onMount(() => void load())
  onCleanup(() => controller.abort())
  onCleanup(
    context.data.on("session.deleted", (event) =>
      setState("sessions", (sessions) => sessions.filter((session) => session.id !== event.data.sessionID)),
    ),
  )
  const sessions = createMemo(() => {
    const values = new Map(state.sessions.map((session) => [session.id, session]))
    for (const session of context.data.session.list()) values.set(session.id, session)
    return [...values.values()].filter((session) => !session.parentID).sort((a, b) => b.time.updated - a.time.updated)
  })
  return (
    <box flexShrink={0}>
      <text fg={context.theme.text.base}>
        <b>Sessions</b>
      </text>
      <For each={sessions()}>
        {(session) => (
          <text
            id={`sidebar-session-${session.id}`}
            fg={session.id === props.sessionID ? context.theme.brand.primary : context.theme.text.muted}
            wrapMode="none"
            height={1}
            onMouseUp={() => context.ui.router.navigate({ type: "session", sessionID: session.id })}
          >
            {session.id === props.sessionID ? "› " : "  "}
            {withTimestampedFallback(session)}
          </text>
        )}
      </For>
      <Show when={state.loading}>
        <text fg={context.theme.text.muted}>Loading sessions…</text>
      </Show>
      <Show when={!state.loading && (state.cursor || state.error)}>
        <text id="sidebar-sessions-more" fg={context.theme.brand.primary} onMouseUp={() => void load()}>
          {state.error ? "Could not load sessions · retry" : "Load older sessions"}
        </text>
      </Show>
      <text fg={context.theme.brand.primary} onMouseUp={() => keymap.dispatch("session.list")}>
        Search all sessions
      </text>
    </box>
  )
}

export default Plugin.define({
  id: "bolt.sidebar.sessions",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (props) => <SidebarSessions context={context} sessionID={props.sessionID} />,
    })
  },
})
