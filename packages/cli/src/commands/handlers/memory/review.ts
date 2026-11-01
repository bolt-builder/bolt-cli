import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { run } from "./shared"

export default Runtime.handler(Commands.commands.memory.commands.review, (input) =>
  run({ action: "review", enabled: input.mode === "on" }),
)
