import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { connect, pick, rows } from "../worktree"

export default Runtime.handler(Commands.commands.worktree.commands.remove, (input) =>
  Effect.gen(function* () {
    const connection = yield* connect()
    const list = yield* Effect.tryPromise({ try: () => rows(connection), catch: (cause) => cause })
    const row = pick(list, input.worktree)
    if (!row)
      return yield* Effect.fail(
        new Error(`Could not find exactly one worktree matching "${input.worktree}". Check bolt worktree list.`),
      )
    yield* Effect.tryPromise({
      try: () =>
        connection.client.worktree.remove({
          projectID: connection.location.project.id,
          directory: row.directory,
          force: false,
        }),
      catch: (cause) => cause,
    })
    process.stdout.write(`Removed ${row.name} (${row.directory})\n`)
  }),
)
