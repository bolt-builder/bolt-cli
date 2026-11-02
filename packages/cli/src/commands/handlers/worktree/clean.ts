import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { connect, rows, table } from "../worktree"
import { errorMessage } from "../../../util/error"

export default Runtime.handler(Commands.commands.worktree.commands.clean, (input) =>
  Effect.gen(function* () {
    const connection = yield* connect()
    const list = yield* Effect.tryPromise({ try: () => rows(connection), catch: (cause) => cause })
    if (!list.length) {
      process.stdout.write("No agent worktrees to clean.\n")
      return
    }
    if (!input.apply) {
      process.stdout.write(
        "Would remove:\n" +
          table(list)
            .map((line) => "  " + line)
            .join("\n") +
          "\nRerun with --apply to remove them.\n",
      )
      return
    }
    const failures: string[] = []
    for (const row of list)
      yield* Effect.tryPromise({
        try: () =>
          connection.client.worktree.remove({
            projectID: connection.location.project.id,
            directory: row.directory,
            force: false,
          }),
        catch: (cause) => cause,
      }).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            process.stdout.write(`Removed ${row.name} (${row.directory})\n`)
          }),
        ),
        Effect.catch((error) =>
          Effect.sync(() => {
            failures.push(`${row.name}: ${errorMessage(error)}`)
          }),
        ),
      )
    if (failures.length) return yield* Effect.fail(new Error(failures.join("\n")))
  }),
)
