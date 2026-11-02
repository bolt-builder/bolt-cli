import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { target, update } from "./shared"
export default Runtime.handler(Commands.commands.config.commands.set, (input) =>
  Effect.gen(function* () {
    const file = yield* target(input.global)
    const chosen = yield* update(file, input.key, input.value)
    process.stdout.write(`Set ${input.key} = ${JSON.stringify(chosen)} in ${file}\n`)
  }),
)
