import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { run } from "./shared"

export default Runtime.handler(Commands.commands.memory.commands.conflicts, (input) =>
  run({ action: "conflicts", fix: input.fix }),
)
