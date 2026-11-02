import { Effect, Option } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { clients, request } from "./handoff/shared"
import { errorMessage } from "../../util/error"
export { endpoint } from "./handoff/shared"

export default Runtime.handler(Commands.commands.push, (input) =>
  Effect.gen(function* () {
    const client = yield* clients(input)
    const data = yield* request(() => client.local.experimental.session.export({ sessionID: input.sessionID }))
    const location = yield* request(() =>
      client.remote.location.get({ location: Option.isSome(input.dir) ? { directory: input.dir.value } : undefined }),
    )
    yield* request(() =>
      client.remote.experimental.session.import({ ...data, location: { directory: location.directory } }),
    )
    process.stdout.write(
      `Pushed session ${input.sessionID} to ${input.url}\nResume it on that machine with: bolt --session ${input.sessionID}\n`,
    )
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(`Push failed: ${errorMessage(error)}\n`)
        process.exitCode ||= 1
      }),
    ),
  ),
)
