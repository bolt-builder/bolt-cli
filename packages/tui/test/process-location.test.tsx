/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import type { Plugin } from "@opencode/plugin/tui"
import { onMount } from "solid-js"
import { ConfigProvider } from "../src/config"
import { ClientProvider } from "../src/context/client"
import { DataProvider, useData } from "../src/context/data"
import { Keymap } from "../src/context/keymap"
import { LocationProvider, useLocation } from "../src/context/location"
import { RouteProvider } from "../src/context/route"
import { TuiAppProvider } from "../src/context/runtime"
import { StorageProvider, useStorage } from "../src/context/storage"
import { ThemeProvider } from "../src/context/theme"
import { Processes } from "../src/feature-plugins/system/process"
import { DialogProvider, useDialog } from "../src/ui/dialog"
import { ToastProvider } from "../src/ui/toast"
import { emptyThemeSource, tmpdir } from "./fixture/fixture"
import { TestTuiContexts } from "./fixture/tui-environment"
import { createApi, createEventStream, createFetch, directory, json } from "./fixture/tui-client"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"

test("changing location clears selected process output and ignores the old location's result", async () => {
  await using temporary = await tmpdir()
  const events = createEventStream()
  const calls = createFetch((url) => {
    if (url.pathname === "/api/session/ses_process_location/message")
      return json({ data: [{
        type: "assistant", id: "msg_location", agent: "explore", model: { providerID: "fixture", id: "fixture" },
        time: { created: 1 }, content: [{ type: "text", text: "OLD LOCATION OUTPUT" }],
      }], cursor: {} })
  }, events)
  let location!: ReturnType<typeof useLocation>
  let storage!: ReturnType<typeof useStorage>
  const job = { id: "ses_process_location", title: "Location job", type: "subagent", status: "running", started_at: 1 }
  const pending = Promise.withResolvers<(typeof job)[]>()
  let listCalls = 0
  function Probe() {
    location = useLocation()
    storage = useStorage()
    const data = useData()
    const dialog = useDialog()
    const context = {
      data,
      client: { rpc: () => ({
        list: async () => ++listCalls === 2 ? pending.promise : [job],
        output: async () => null,
        cancel: async () => null,
      }) },
      ui: { dialog: { set: () => {} }, toast: { show: () => {} } },
    } as unknown as Plugin.Context
    onMount(() => dialog.replace(() => <Processes context={context} />))
    return null
  }
  const app = await testRender(() => (
    <TestTuiContexts paths={{ state: temporary.path }}>
      <TuiAppProvider value={{ name: "test", version: "test", channel: "test" }}>
        <StorageProvider>
          <ConfigProvider config={createTuiResolvedConfig()}>
            <Keymap.Provider>
              <ToastProvider>
                <RouteProvider>
                  <ClientProvider api={createApi(calls.fetch)}>
                    <DataProvider directory={directory}>
                      <LocationProvider>
                        <ThemeProvider mode="dark" source={emptyThemeSource}>
                          <DialogProvider><Probe /></DialogProvider>
                        </ThemeProvider>
                      </LocationProvider>
                    </DataProvider>
                  </ClientProvider>
                </RouteProvider>
              </ToastProvider>
            </Keymap.Provider>
          </ConfigProvider>
        </StorageProvider>
      </TuiAppProvider>
    </TestTuiContexts>
  ), { width: 100, height: 30, kittyKeyboard: true })
  app.renderer.start()
  try {
    await app.waitForFrame((frame) => frame.includes("Location job"))
    app.mockInput.pressEnter()
    await app.waitForFrame((frame) => frame.includes("OLD LOCATION OUTPUT"))
    await app.waitFor(() => listCalls === 2)
    location.set({ directory: `${directory}/other` })
    await app.waitForFrame((value) => value.includes("No background processes"))
    pending.resolve([job])
    await Bun.sleep(100)
    const frame = app.captureCharFrame()
    expect(frame).not.toContain("OLD LOCATION OUTPUT")
    expect(frame).not.toContain("Location job")
  } finally {
    app.renderer.destroy()
    await storage.flush()
  }
})
