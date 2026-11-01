import { createSignal } from "solid-js"
import { useConfig } from "../config"
import { useArgs } from "./args"
import { createSimpleContext } from "./helper"

export type PermissionMode = "prompt" | "autoaccept"

export const { use: usePermission, provider: PermissionProvider } = createSimpleContext({
  name: "Permission",
  init: () => {
    const args = useArgs()
    const config = useConfig()
    const [override, setOverride] = createSignal<PermissionMode>()
    const mode = (): PermissionMode => override() ?? (args.auto ? "autoaccept" : config.data.session.permissions)
    return {
      get mode(): PermissionMode {
        return mode()
      },
      async toggle() {
        const next = mode() === "autoaccept" ? "prompt" : "autoaccept"
        await config.update((draft) => {
          draft.session = { ...draft.session, permissions: next }
        })
        // An explicit interactive toggle also overrides the startup --auto flag.
        setOverride(next)
      },
    }
  },
})
