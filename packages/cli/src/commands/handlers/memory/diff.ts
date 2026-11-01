import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { run } from "./shared"

export default Runtime.handler(Commands.commands.memory.commands.diff, (input) =>
  run({ action: "diff", apply: input.apply, discard: input.discard }),
)
