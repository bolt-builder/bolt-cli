import { Prompt, type PromptRef } from "../component/prompt"
import { batch, createEffect, createMemo, createSignal, Match, onMount, Show, Switch } from "solid-js"
import { RGBA } from "@opentui/core"
import { Logo } from "../component/logo"
import { SessionSidebar } from "../component/session-sidebar"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useRouteData } from "../context/route"
import { usePromptRef } from "../context/prompt"
import { useKV } from "../context/kv.tsx"
import { useLocal } from "../context/local"
import { usePluginRuntime } from "../plugin/runtime"
import { useEditorContext } from "../context/editor"
import { useTerminalDimensions } from "@opentui/solid"
import { useTuiConfig } from "../config"
import { useDialog } from "../ui/dialog"
import { OPENCODE_BASE_MODE, useBindings } from "../keymap"
import { HomeSessionDestinationProvider } from "./home/session-destination"

let once = false
const placeholder = {
  normal: ["Fix a TODO in the codebase", "What is the tech stack of this project?", "Fix broken tests"],
  shell: ["ls -la", "git status", "pwd"],
}

export function Home() {
  const pluginRuntime = usePluginRuntime()
  const sync = useSync()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const [ref, setRef] = createSignal<PromptRef | undefined>()
  const args = useArgs()
  const local = useLocal()
  const editor = useEditorContext()
  const dimensions = useTerminalDimensions()
  const tuiConfig = useTuiConfig()
  const promptMaxWidth = createMemo(() => {
    const configured = tuiConfig.prompt?.max_width
    if (configured === "auto") return Math.max(75, Math.floor(dimensions().width * 0.7))
    return configured ?? 75
  })
  let sent = false

  const kv = useKV()
  const dialog = useDialog()
  const [sidebarPref, setSidebarPref] = kv.signal<"auto" | "hide">("home_sidebar", "auto")
  const [sidebarOpen, setSidebarOpen] = createSignal(false)
  const wide = createMemo(() => dimensions().width > 120)
  const sidebarVisible = createMemo(() => {
    if (sidebarOpen()) return true
    return sidebarPref() === "auto" && wide()
  })
  const toggleSidebar = () => {
    batch(() => {
      const isVisible = sidebarVisible()
      setSidebarPref(() => (isVisible ? "hide" : "auto"))
      setSidebarOpen(!isVisible)
    })
  }

  useBindings(() => ({
    commands: [
      {
        namespace: "palette",
        name: "session.sidebar.toggle",
        title: sidebarVisible() ? "Hide sidebar" : "Show sidebar",
        category: "Home",
        slashName: "sidebar",
        run: () => {
          toggleSidebar()
          dialog.clear()
        },
      },
    ],
  }))
  useBindings(() => ({
    mode: OPENCODE_BASE_MODE,
    bindings: tuiConfig.keybinds.gather("home", ["session.sidebar.toggle"]),
  }))
  useBindings(() => ({
    enabled: sidebarVisible() && !wide(),
    bindings: [
      {
        key: "escape",
        desc: "Close sidebar",
        group: "Home",
        cmd: () => toggleSidebar(),
      },
    ],
  }))

  onMount(() => {
    editor.clearSelection()
  })

  const bind = (r: PromptRef | undefined) => {
    setRef(r)
    promptRef.set(r)
    if (once || !r) return
    if (route.prompt) {
      r.set(route.prompt)
      once = true
      return
    }
    if (!args.prompt) return
    r.set({ input: args.prompt, parts: [] })
    once = true
  }

  // Wait for sync and model store to be ready before auto-submitting --prompt
  createEffect(() => {
    const r = ref()
    if (sent) return
    if (!r) return
    if (!sync.ready || !local.model.ready) return
    if (!args.prompt) return
    if (r.current.input !== args.prompt) return
    sent = true
    r.submit()
  })

  return (
    <HomeSessionDestinationProvider>
      <box flexDirection="row" flexGrow={1} minHeight={0}>
        <Show when={sidebarVisible()}>
          <Switch>
            <Match when={wide()}>
              <SessionSidebar />
            </Match>
            <Match when={!wide()}>
              <box
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                alignItems="flex-start"
                backgroundColor={RGBA.fromInts(0, 0, 0, 70)}
              >
                <box position="absolute" top={0} left={0} right={0} bottom={0} onMouseDown={() => toggleSidebar()} />
                <SessionSidebar overlay />
              </box>
            </Match>
          </Switch>
        </Show>
        <box
          flexGrow={1}
          minHeight={0}
          alignItems="center"
          paddingTop={2}
          paddingBottom={1}
          paddingLeft={2}
          paddingRight={2}
        >
          <box height={4} minHeight={0} flexShrink={1} />
          <box flexShrink={0}>
            <pluginRuntime.Slot name="home_logo" mode="replace">
              <Logo />
            </pluginRuntime.Slot>
          </box>
          <box height={1} minHeight={0} flexShrink={1} />
          <box width="100%" maxWidth={promptMaxWidth()} zIndex={1000} paddingTop={1} flexShrink={0}>
            <pluginRuntime.Slot name="home_prompt" mode="replace" ref={bind}>
              <Prompt ref={bind} right={<pluginRuntime.Slot name="home_prompt_right" />} placeholders={placeholder} />
            </pluginRuntime.Slot>
          </box>
          <pluginRuntime.Slot name="home_bottom" />
          <box flexGrow={1} minHeight={0} />
          <Toast />
        </box>
      </box>
      <box width="100%" flexShrink={0}>
        <pluginRuntime.Slot name="home_footer" mode="single_winner" />
      </box>
    </HomeSessionDestinationProvider>
  )
}
