import { createMemo } from "solid-js"
import { useData } from "../../context/data"
import { DialogSelect } from "../../ui/dialog-select"
import { sessionTodos, todoMarker } from "../../util/todo"

export function DialogTodos(props: { sessionID: string }) {
  const data = useData()
  const todos = createMemo(() =>
    sessionTodos(data.session.message.list(props.sessionID), data.session.get(props.sessionID)?.revert?.messageID),
  )
  return (
    <DialogSelect
      title="Todos"
      placeholder="Search todos"
      options={todos().map((todo, index) => ({
        title: `${todoMarker(todo.status)} ${todo.content}`,
        value: index,
        footer: todo.status.replace("_", " "),
      }))}
    />
  )
}
