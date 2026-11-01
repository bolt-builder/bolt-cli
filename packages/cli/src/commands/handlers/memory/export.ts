import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { Option } from "effect"
import { run } from "./shared"

export default Runtime.handler(Commands.commands.memory.commands.export, (input) =>
  run({ action: "export" }, Option.getOrUndefined(input.out)),
)
