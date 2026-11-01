import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { Option } from "effect"
import { run } from "./shared"

export default Runtime.handler(Commands.commands.memory.commands.team, (input) =>
  run({ action: "team", operation: input.action, ...(Option.isSome(input.query) ? { query: input.query.value } : {}) }),
)
