import { Plugin } from "@opencode/plugin/tui"
import { BoltSandbox } from "@opencode/schema/bolt-sandbox"
import { Show } from "solid-js"
import { useLocation } from "../../context/location"

export default Plugin.define({
  id: "bolt.sandbox",
  setup(context) {
    const rpc = context.client.rpc(BoltSandbox.Definition)
    context.ui.slot({
      append: "session.composer.top",
      render: (props) => (
        <Show when={context.data.session.get(props.sessionID)?.metadata?.sandbox === true}>
          <text fg={context.theme.text.muted}>Filesystem sandbox on</text>
        </Show>
      ),
    })
    context.ui.slot({
      append: "app",
      render() {
        const location = useLocation()
        let pending = false
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "session.sandbox",
              title: "Toggle filesystem sandbox",
              group: "Session",
              palette: true,
              slash: { name: "sandbox" },
              async run() {
                if (pending) return
                pending = true
                try {
                  const route = context.ui.router.current()
                  const session =
                    route.type === "session"
                      ? await context.client.session.get({ sessionID: route.sessionID })
                      : await context.client.session.create({ location: location.ref })
                  const result = await rpc.set(
                    { sessionID: session.id, enabled: session.metadata?.sandbox !== true },
                    { location: session.location },
                  )
                  if (route.type !== "session") context.ui.router.navigate({ type: "session", sessionID: session.id })
                  context.ui.toast.show({
                    variant: "success",
                    message: `Filesystem sandbox ${result.enabled ? "enabled" : "disabled"}`,
                  })
                } catch (error) {
                  context.ui.toast.show({ variant: "error", message: String(error) })
                } finally {
                  pending = false
                }
              },
            },
          ],
        }))
        return null
      },
    })
  },
})
