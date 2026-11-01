import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { run } from "./shared"

export default Runtime.handler(Commands.commands.memory.commands.search, (input) =>
  run({ action: "search", query: input.query, limit: input.limit }),
)
