import { Effect } from "effect"
import { effectCmd, fail } from "../effect-cmd"
import { withNetworkOptions, resolveNetworkOptions, enforceLoopbackWithoutAuth } from "../network"
import { Flag } from "@opencode-ai/core/flag/flag"

export const ServeCommand = effectCmd({
  command: "serve",
  builder: (yargs) =>
    withNetworkOptions(yargs).option("api", {
      type: "boolean",
      default: false,
      describe: "print the stable REST API surface as JSON, then keep serving",
    }),
  describe: "starts a headless bolt server",
  // Server loads instances per-request via x-opencode-directory header — no
  // need for an ambient project InstanceContext at startup.
  instance: false,
  handler: Effect.fn("Cli.serve")(function* (args) {
    const { Server } = yield* Effect.promise(() => import("../../server/server"))
    if (!Flag.OPENCODE_SERVER_PASSWORD) {
      console.log("Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.")
    }
    const resolved = yield* resolveNetworkOptions(args)
    const guard = enforceLoopbackWithoutAuth(resolved)
    if (!guard.ok) return yield* fail(guard.error)
    const server = yield* Effect.promise(() => Server.listen(guard.opts))
    console.log(`opencode server listening on http://${server.hostname}:${server.port}`)
    if (args.api) {
      const { Surface } = yield* Effect.promise(() => import("../../server/surface"))
      console.log(JSON.stringify(Surface.surface(`http://${server.hostname}:${server.port}`), null, 2))
    }

    yield* Effect.never
  }),
})
