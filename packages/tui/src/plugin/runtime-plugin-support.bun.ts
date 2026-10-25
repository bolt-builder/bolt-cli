import { ensurePluginRuntime, provides } from "@bolt-ai/plugin/runtime"
import { Plugin, PluginContextProvider, usePlugin } from "@bolt-ai/plugin/tui"
import { ensureRuntimePluginSupport } from "@opentui/solid/runtime-plugin-support/configure"

ensurePluginRuntime()
ensureRuntimePluginSupport({
  additional: {
    "@bolt-ai/plugin/tui": { Plugin, PluginContextProvider, usePlugin },
  },
  preserve: provides,
})
