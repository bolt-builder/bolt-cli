import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { target, update } from "./shared"
export default Runtime.handler(Commands.commands.config.commands.unset, (input) =>
  Effect.gen(function* () {
    const file = yield* target(input.global)
    yield* update(file, input.key)
    process.stdout.write(`Unset ${input.key} in ${file}\n`)
  }),
)
