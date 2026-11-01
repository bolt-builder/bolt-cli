/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { ConfigProvider, useConfig, type Info } from "../../src/config"
import { ArgsProvider } from "../../src/context/args"
import { PermissionProvider, usePermission } from "../../src/context/permission"
import { createTuiResolvedConfig } from "../fixture/tui-runtime"

test("permission mode follows later configuration updates unless startup auto was explicitly overridden", async () => {
  for (const auto of [false, true]) {
    let saved: Info = { session: { permissions: "prompt" } }
    let controls: { permission: ReturnType<typeof usePermission>; config: ReturnType<typeof useConfig> } | undefined
    const service = {
      get: async () => saved,
      update: async (fn: (draft: Info) => void) => {
        const next = structuredClone(saved)
        fn(next)
        saved = next
        return next
      },
    }
    const Probe = () => {
      controls = { permission: usePermission(), config: useConfig() }
      return <text>fixture</text>
    }
    const app = await testRender(
      () => (
        <ConfigProvider config={createTuiResolvedConfig(saved)} service={service}>
          <ArgsProvider auto={auto}>
            <PermissionProvider>
              <Probe />
            </PermissionProvider>
          </ArgsProvider>
        </ConfigProvider>
      ),
      { width: 30, height: 2 },
    )
    app.renderer.start()
    try {
      if (!controls) throw new Error("missing permission context")
      const { permission, config } = controls
      expect(permission.mode).toBe(auto ? "autoaccept" : "prompt")
      await permission.toggle()
      expect(permission.mode).toBe(auto ? "prompt" : "autoaccept")
      await config.update((draft) => {
        draft.session.permissions = auto ? "autoaccept" : "prompt"
      })
      expect(permission.mode).toBe("prompt")
    } finally {
      app.renderer.destroy()
    }
  }
})
