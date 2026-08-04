import { Effect } from "effect"
import { effectCmd, fail } from "../effect-cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "@opencode-ai/core/flag/flag"

export const ServeCommand = effectCmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless bolt server",
  // Server loads instances per-request via x-opencode-directory header — no
  // need for an ambient project InstanceContext at startup.
  instance: false,
  handler: Effect.fn("Cli.serve")(function* (args) {
    const { Server } = yield* Effect.promise(() => import("../../server/server"))
    if (!Flag.OPENCODE_SERVER_PASSWORD) {
      console.log("Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.")
    }
    const opts = yield* resolveNetworkOptions(args)
    // Refuse to expose an unauthenticated server beyond loopback: the API
    // grants file read/write and shell execution, so binding 0.0.0.0 (or
    // advertising over mDNS) without a password hands that to the whole LAN.
    const loopback = ["127.0.0.1", "localhost", "::1"].includes(opts.hostname)
    if (!Flag.OPENCODE_SERVER_PASSWORD && (!loopback || opts.mdns)) {
      return yield* fail(
        "Refusing to listen on a non-loopback interface without authentication. Set OPENCODE_SERVER_PASSWORD or bind to 127.0.0.1.",
      )
    }
    const server = yield* Effect.promise(() => Server.listen(opts))
    console.log(`opencode server listening on http://${server.hostname}:${server.port}`)

    yield* Effect.never
  }),
})
