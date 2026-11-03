import { Plugin } from "@opencode/plugin/tui"
import { BoltSandbox } from "@opencode/schema/bolt-sandbox"
import { Show } from "solid-js"
import { useLocation } from "../../context/location"
import { useLocal } from "../../context/local"
import { errorMessage } from "../../util/error"

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
        const local = useLocal()
        let pending = false
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "session.sandbox",
              title: "Toggle filesystem sandbox",
              group: "Session",
              palette: true,
              slash: { name: "sandbox", arguments: true },
              async run() {
                if (pending) return
                pending = true
                try {
                  const route = context.ui.router.current()
                  const model = context.ui.model.current()
                  const session =
                    route.type === "session"
                      ? await context.client.session.get({ sessionID: route.sessionID })
                      : await context.client.session.create({
                          location: location.ref ?? context.data.location.default(),
                          agent: local.agent.current()?.id,
                          model: model ? { providerID: model.providerID, id: model.modelID, variant: model.variant } : undefined,
                        })
                  if (route.type !== "session") context.ui.router.navigate({ type: "session", sessionID: session.id })
                  const result = await rpc.set(
                    { sessionID: session.id, enabled: session.metadata?.sandbox !== true },
                    { location: session.location },
                  )
                  context.ui.toast.show({
                    variant: "success",
                    message: `Filesystem sandbox ${result.enabled ? "enabled" : "disabled"}`,
                  })
                } catch (error) {
                  context.ui.toast.show({ variant: "error", message: errorMessage(error) })
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
