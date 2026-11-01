export * as SandboxPlugin from "./sandbox.js"

import { define } from "@opencode/plugin/effect/plugin"
import { BoltSandbox } from "@opencode/schema/bolt-sandbox"
import { Effect } from "effect"
import { Sandbox } from "../sandbox.js"

export const Plugin = define({
  id: "bolt.sandbox",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.rpc
      .register(BoltSandbox.Definition, {
        set: (input, context) =>
          Effect.gen(function* () {
            const session = yield* ctx.session.get({ sessionID: input.sessionID })
            if (input.enabled) {
              if (session.location.workspaceID !== undefined)
                return yield* new Sandbox.UnsupportedError({
                  message: "Filesystem sandboxing is not available for remote workspaces.",
                })
              // Availability is checked before persisting. Execution still fails closed if the wrapper later disappears.
              yield* Sandbox.wrap({ command: "true", shell: "/bin/sh", writable: [] })
            }
            yield* ctx.session.update({
              sessionID: input.sessionID,
              metadata: { ...session.metadata, sandbox: input.enabled },
            })
            return { enabled: input.enabled }
          }).pipe(
            Effect.mapError((error) =>
              context.error("unavailable", error instanceof Error ? error.message : String(error), {}),
            ),
          ),
      })
      .pipe(Effect.orDie)
  }),
})
