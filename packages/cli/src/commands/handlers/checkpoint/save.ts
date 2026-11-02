import { Effect, Option } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { connect } from "./shared"

export default Runtime.handler(Commands.commands.checkpoint.commands.save, (input) =>
  Effect.gen(function* () {
    const { client, rpc, options } = yield* connect(input.name)
    yield* Effect.tryPromise(async () => {
      const requested = Option.getOrUndefined(input.session)
      const sessionID = input.repoOnly
        ? undefined
        : (requested ??
          (await client.location.get(options).then(async (location) => {
            const result = await client.session.list({
              project: location.project.id,
              parentID: null,
              order: "desc",
              limit: 1,
            })
            return result.data[0]?.id
          })))
      const info = await rpc.save({ name: input.name, ...(sessionID ? { sessionID } : {}) }, options)
      process.stdout.write(
        `Saved checkpoint "${info.name}"${info.sessionID ? ` (session ${info.sessionID})` : " (repo only)"}\n`,
      )
    })
  }),
)
