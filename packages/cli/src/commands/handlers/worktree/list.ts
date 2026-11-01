import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { connect, rows, table } from "../worktree"

export default Runtime.handler(Commands.commands.worktree.commands.list, () =>
  Effect.gen(function* () {
    const connection = yield* connect()
    const list = yield* Effect.tryPromise({ try: () => rows(connection), catch: (cause) => cause })
    process.stdout.write(
      list.length
        ? table(list).join("\n") + "\n"
        : "No agent worktrees. Create one with: bolt worktree create [name]\n",
    )
  }),
)
