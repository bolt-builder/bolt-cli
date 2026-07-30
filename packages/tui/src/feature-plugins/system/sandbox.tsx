import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, Show } from "solid-js"

const id = "internal:sandbox"

function enabled(api: TuiPluginApi, sessionID: string) {
  return api.state.session.get(sessionID)?.metadata?.["sandbox"] === true
}

function current(api: TuiPluginApi) {
  const route = api.route.current
  if (route.name !== "session") return
  const sessionID = "params" in route ? route.params?.sessionID : undefined
  if (typeof sessionID !== "string") return
  return sessionID
}

async function ensure(api: TuiPluginApi) {
  const found = current(api)
  if (found) return found
  const result = await api.client.session.create({}, { throwOnError: true })
  const sessionID = result.data?.id
  if (sessionID) api.route.navigate("session", { sessionID })
  return sessionID
}

function View(props: { api: TuiPluginApi; sessionID: string }) {
  const on = createMemo(() => enabled(props.api, props.sessionID))
  return (
    <box flexShrink={0}>
      <Show when={on()}>
        <text fg={props.api.theme.current.success}>◆ Sandbox on</text>
      </Show>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  const pending = new Set<string>()

  api.keymap.registerLayer({
    commands: [
      {
        namespace: "palette",
        name: "session.toggle.sandbox",
        title: "Toggle sandbox",
        desc: "Toggle sandboxed execution for the current session",
        category: "Session",
        slashName: "sandbox",
        async run() {
          const sessionID = await ensure(api).catch((err) => {
            api.ui.toast({ message: String(err), variant: "error", duration: 5000 })
            return undefined
          })
          if (!sessionID || pending.has(sessionID)) return
          pending.add(sessionID)
          try {
            const next = !enabled(api, sessionID)
            const meta = api.state.session.get(sessionID)?.metadata
            await api.client.session.update({ sessionID, metadata: { ...meta, sandbox: next } }, { throwOnError: true })
            api.ui.toast({ message: `Sandbox ${next ? "enabled" : "disabled"}`, variant: "success" })
            api.ui.dialog.clear()
          } catch (err) {
            api.ui.toast({ message: String(err), variant: "error", duration: 5000 })
          } finally {
            pending.delete(sessionID)
          }
        },
      },
    ],
  })

  api.slots.register({
    order: 50,
    slots: {
      session_prompt_right(_ctx, props) {
        return <View api={api} sessionID={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = { id, tui }

export default plugin
