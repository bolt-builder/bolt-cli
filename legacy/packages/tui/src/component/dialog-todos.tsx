import { TextAttributes } from "@opentui/core"
import { For, Show, createMemo } from "solid-js"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useSync } from "../context/sync"
import { TodoItem } from "./todo-item"

export type DialogTodosProps = {
  sessionID: string
}

// Live view of the agent's task list for a session. todo.updated events write
// straight into the sync store, so the dialog refreshes in place while the
// agent works. Unlike the sidebar panel, this shows the full list, including
// completed items, and works on narrow terminals.
export function DialogTodos(props: DialogTodosProps) {
  const sync = useSync()
  const { theme } = useTheme()
  const dialog = useDialog()
  const todos = createMemo(() => sync.data.todo[props.sessionID] ?? [])
  const done = createMemo(() => todos().filter((item) => item.status === "completed").length)

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Todos
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <Show when={todos().length > 0} fallback={<text fg={theme.textMuted}>No todos in this session yet</text>}>
        <box>
          <For each={todos()}>{(item) => <TodoItem status={item.status} content={item.content} />}</For>
        </box>
        <text fg={theme.textMuted}>
          {done()}/{todos().length} completed
        </text>
      </Show>
    </box>
  )
}
