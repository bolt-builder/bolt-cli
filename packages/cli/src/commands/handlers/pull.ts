import { Effect, Option } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { clients, request } from "./handoff/shared"
import { errorMessage } from "../../util/error"

export default Runtime.handler(Commands.commands.pull, (input) =>
  Effect.gen(function* () {
    const client = yield* clients(input)
    const directory = Option.getOrUndefined(input.dir)
    if (directory !== undefined) yield* request(() => client.remote.location.get({ location: { directory } }))
    const data = yield* request(() => client.remote.experimental.session.export({ sessionID: input.sessionID }))
    const location = yield* request(() => client.local.location.get({ location: { directory: process.cwd() } }))
    yield* request(() =>
      client.local.experimental.session.import({ ...data, location: { directory: location.directory } }),
    )
    process.stdout.write(
      `Pulled session ${input.sessionID} from ${input.url}\nResume it with: bolt --session ${input.sessionID}\n`,
    )
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(`Pull failed: ${errorMessage(error)}\n`)
        process.exitCode ||= 1
      }),
    ),
  ),
)
