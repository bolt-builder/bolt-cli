import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { connect } from "./shared"

export default Runtime.handler(Commands.commands.checkpoint.commands.rewind, (input) =>
  Effect.gen(function* () {
    const { rpc, options } = yield* connect(input.name)
    yield* Effect.tryPromise(async () => {
      const info = await rpc.rewind({ name: input.name }, options)
      process.stdout.write(
        `Rewound to checkpoint "${info.name}".${info.sessionID ? " Repo and conversation restored." : " Repo restored."}\n`,
      )
    })
  }),
)
