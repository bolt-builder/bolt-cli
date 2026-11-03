import { Plugin } from "@opencode/plugin/tui"
import { BoltMemory } from "@opencode/schema/bolt-memory"
import { useLocation } from "../../context/location"
import { errorMessage } from "../../util/error"

export default Plugin.define({
  id: "bolt.memory",
  setup(context) {
    const rpc = context.client.rpc(BoltMemory.Definition)
    context.ui.slot({
      append: "app",
      render() {
        const location = useLocation()
        const run = async (text?: string) => {
          const route = context.ui.router.current()
          const sessionID = route.type === "session" ? route.sessionID : undefined
          const options = { location: location.ref }
          const value =
            text?.trim() ||
            (await context.ui.dialog.prompt({
              title: "Bolt project memory",
              description: (await rpc.command({ text: "", sessionID }, options)).text,
              placeholder: "status, on, remember <text>, correct <text>, forget <query>…",
            }))
          if (value === undefined) return
          const result = await rpc.command({ text: value, sessionID }, options)
          await context.ui.dialog.alert({ title: "Bolt project memory", message: result.text })
        }
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "memory.help",
              title: "Project memory",
              group: "System",
              palette: true,
              slash: { name: "memory", aliases: ["mem"], arguments: true },
              run: (text) =>
                run(text).catch((error) => context.ui.toast.show({ variant: "error", message: errorMessage(error) })),
            },
          ],
        }))
        return null
      },
    })
  },
})
