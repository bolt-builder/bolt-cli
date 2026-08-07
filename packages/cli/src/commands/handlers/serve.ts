import { NodeHttpServer } from "@effect/platform-node"
import { Credential } from "@opencode-ai/core/credential"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { PermissionSaved } from "@opencode-ai/core/permission/saved"
import { Context, Layer, Option } from "effect"
import * as Effect from "effect/Effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { createServer } from "node:http"
import { createRoutes } from "@opencode-ai/server/routes"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Daemon } from "../../services/daemon"

export default Runtime.handler(
  Commands.commands.serve,
  Effect.fn("cli.serve")(function* (input) {
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const daemon = yield* Daemon.Service
        const address = yield* listen(input.hostname, input.port, yield* daemon.password())
        if (input.register) yield* daemon.register(address)
        console.log(`server listening on ${HttpServer.formatAddress(address)}`)
        return yield* Effect.never
      }),
    )
  }),
)

function listen(hostname: string, port: Option.Option<number>, password: string) {
  if (Option.isSome(port)) return bind(hostname, port.value, password)
  // Only walk to the next port when the current one is taken; other bind errors
  // (bad hostname, permissions) should surface immediately instead of after ~61k retries.
  const next = (port: number): ReturnType<typeof bind> =>
    bind(hostname, port, password).pipe(
      Effect.catch((error) =>
        port !== 65_535 && errorCode(error) === "EADDRINUSE" ? next(port + 1) : Effect.fail(error),
      ),
    )
  return next(4096)
}

function errorCode(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const record = value as Record<string, unknown>
  if (typeof record.code === "string") return record.code
  return errorCode(record.cause)
}

function bind(hostname: string, port: number, password: string) {
  return Layer.build(
    HttpRouter.serve(createRoutes(password), { disableListenLog: true, disableLogger: true }).pipe(
      Layer.provideMerge(NodeHttpServer.layer(() => createServer(), { port, host: hostname })),
      Layer.provide(AppNodeBuilder.build(LayerNode.group([Credential.node, PermissionSaved.node]))),
    ),
  ).pipe(Effect.map((context) => Context.get(context, HttpServer.HttpServer).address))
}
