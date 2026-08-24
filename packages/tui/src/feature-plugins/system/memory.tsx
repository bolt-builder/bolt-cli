import type { TuiPlugin } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { DialogMemoryHelp } from "../../component/dialog-memory"

const id = "internal:memory"

const tui: TuiPlugin = async (api) => {
  api.keymap.registerLayer({
    commands: [
      {
        namespace: "palette",
        name: "memory.help",
        title: "Memory",
        desc: "Manage project memory",
        category: "System",
        slashName: "memory",
        slashAliases: ["mem"],
        run() {
          const route = api.route.current
          const param = route.name === "session" && "params" in route ? route.params?.sessionID : undefined
          const sessionID = typeof param === "string" ? param : undefined
          api.ui.dialog.setSize("large")
          api.ui.dialog.replace(() => <DialogMemoryHelp sessionID={sessionID} />)
        },
      },
    ],
  })
}

const plugin: BuiltinTuiPlugin = { id, tui }

export default plugin
