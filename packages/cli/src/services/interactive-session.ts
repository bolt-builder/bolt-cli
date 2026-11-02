import { Context, Effect, FileSystem } from "effect"
import { Global } from "@opencode/util/global"
import { resolve } from "@opencode/tui/config"
import { Config } from "../config"
import { ServerConnection } from "./server-connection"

/** Enter the existing Mini frontend with the same configuration and reconnect handling as `bolt mini`. */
export const resume = Effect.fn("cli.interactive-session.resume")(function* (
  server: ServerConnection.Resolved,
  session: string,
) {
  const { runMini, validateMiniTerminal } = yield* Effect.promise(() => import("../mini"))
  yield* Effect.try(() => validateMiniTerminal())
  const config = yield* Config.Service
  const global = yield* Global.Service
  const resolved = resolve(yield* config.get(), { terminalSuspend: process.platform !== "win32" })
  const fs = yield* FileSystem.FileSystem
  const runService = Effect.runPromiseWith(Context.make(FileSystem.FileSystem, fs))
  const service = server.service
  yield* Effect.tryPromise(() =>
    runMini({
      server: {
        endpoint: server.endpoint,
        reconnect: service ? (signal) => runService(service.reconnect(), { signal }) : undefined,
      },
      session,
      replay: resolved.mini?.replay ?? true,
      replayLimit: resolved.mini?.replay_limit,
      tuiConfig: resolved,
      config: { update: (update) => runService(config.update(update)) },
      paths: { home: global.home, state: global.state, log: global.log },
    }),
  )
})

export * as InteractiveSession from "./interactive-session"
