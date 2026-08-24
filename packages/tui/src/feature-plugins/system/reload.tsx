import type { TuiPlugin } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"

const id = "internal:reload"

const tui: TuiPlugin = async (api) => {
  let pending = false
  api.keymap.registerLayer({
    commands: [
      {
        namespace: "palette",
        name: "app.reload",
        title: "Reload",
        desc: "Reload config, skills, agents, and commands from disk",
        category: "System",
        slashName: "reload",
        async run() {
          if (pending) return
          pending = true
          try {
            await api.client.instance.reload(undefined, { throwOnError: true })
            api.ui.toast({ message: "Reloaded", variant: "success" })
          } catch (err) {
            api.ui.toast({ message: String(err), variant: "error", duration: 5000 })
          } finally {
            pending = false
          }
        },
      },
    ],
  })
}

const plugin: BuiltinTuiPlugin = { id, tui }

export default plugin
