import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { connect } from "./shared"

export default Runtime.handler(Commands.commands.checkpoint.commands.remove, (input) =>
  Effect.gen(function* () {
    const { rpc, options } = yield* connect(input.name)
    yield* Effect.tryPromise(async () => {
      const result = await rpc.remove({ name: input.name }, options)
      process.stdout.write(`Removed checkpoint "${result.removed}".\n`)
    })
  }),
)
