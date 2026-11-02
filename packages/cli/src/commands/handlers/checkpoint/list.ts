import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { age, connect } from "./shared"

export default Runtime.handler(Commands.commands.checkpoint.commands.list, () =>
  Effect.gen(function* () {
    const { rpc, options } = yield* connect()
    yield* Effect.tryPromise(async () => {
      const all = await rpc.list({}, options)
      if (!all.length) {
        process.stdout.write("No checkpoints saved.\n")
        return
      }
      const now = Date.now()
      for (const item of all)
        process.stdout.write(
          `${item.name}  ${age(now, item.time)}  ${item.sessionID ? `session ${item.sessionID}` : "repo only"}\n`,
        )
    })
  }),
)
