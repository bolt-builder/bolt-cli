import { Effect, Option } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { connect } from "../worktree"

export default Runtime.handler(Commands.commands.worktree.commands.create, (input) =>
  Effect.gen(function* () {
    const { client, location } = yield* connect()
    const created = yield* Effect.tryPromise({
      try: () =>
        client.worktree.create({
          projectID: location.project.id,
          from: location.project.directory,
          name: Option.getOrUndefined(input.name),
        }),
      catch: (cause) => cause,
    })
    const name = created.directory.split(/[\\/]/).filter(Boolean).at(-1)
    process.stdout.write(`Created ${name} at ${created.directory}\n`)
    const start = Option.getOrUndefined(input.start)
    if (!start) return
    const shell = yield* Effect.tryPromise({
      try: () =>
        client.shell.create({ location: { directory: created.directory }, cwd: created.directory, command: start }),
      catch: (cause) => cause,
    })
    if (shell.data.status !== "running" && shell.data.exit !== 0)
      return yield* Effect.fail(
        new Error(
          `Worktree created, but startup command failed (${shell.data.status}, exit ${shell.data.exit ?? "unknown"}).`,
        ),
      )
    process.stdout.write(`Startup command: ${shell.data.id} (${shell.data.status})\n`)
  }),
)
