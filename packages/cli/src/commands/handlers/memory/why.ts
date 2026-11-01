import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { Option } from "effect"
import { why } from "./shared"

export default Runtime.handler(Commands.commands.memory.commands.why, (input) =>
  why(input.question.join(" "), Option.getOrUndefined(input.model)),
)
