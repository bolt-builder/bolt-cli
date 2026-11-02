import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { run } from "./shared"

export default Runtime.handler(Commands.commands.memory.commands.import, (input) =>
  run(async () => ({ action: "import", text: await Bun.file(input.file).text() })),
)
