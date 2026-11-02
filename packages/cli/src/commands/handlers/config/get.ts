import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { entries, resolved, select } from "./shared"
export default Runtime.handler(Commands.commands.config.commands.get, (input) =>
  Effect.gen(function* () {
    const found = select(resolved(yield* entries()), input.key)
    if (found === undefined) return yield* Effect.fail(new Error(`No value at "${input.key}"`))
    process.stdout.write((typeof found === "string" ? found : JSON.stringify(found, null, 2)) + "\n")
  }),
)
