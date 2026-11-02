import { Effect, Option } from "effect"
import { Service } from "@opencode/client/effect/service"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServiceConfig } from "../../services/service-config"
import { ServerConnection } from "../../services/server-connection"
import { ServerProcess } from "../../server-process"

export default Runtime.handler(Commands.commands.daemon, (input) =>
  Effect.gen(function* () {
    if (input.stop && input.status) return yield* Effect.fail(new Error("--stop and --status cannot be combined"))
    const options = yield* ServiceConfig.options()
    const existing = yield* Service.discover({ ...options, version: undefined })
    if (input.stop || input.status) {
      if (!existing) return yield* Effect.fail(new Error("no daemon is running"))
      if (input.status) {
        process.stdout.write(`daemon running at ${existing.url}\n`)
        return
      }
      yield* ServerConnection.shutdownPersistentPty(options).pipe(Effect.ignore)
      yield* Service.stop(options)
      process.stdout.write("stopped daemon\n")
      return
    }
    if (existing) return yield* Effect.fail(new Error(`daemon already running at ${existing.url}`))
    return yield* ServerProcess.run({
      mode: "service",
      hostname: Option.getOrUndefined(input.hostname),
      port: Option.getOrUndefined(input.port),
      cors: input.cors.length ? input.cors : undefined,
    })
  }),
)
