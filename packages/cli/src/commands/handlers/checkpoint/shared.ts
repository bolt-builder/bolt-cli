import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { BoltCheckpoint } from "@opencode/schema/bolt-checkpoint"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Effect, Schema } from "effect"
import { ServerConnection } from "../../../services/server-connection"

export const connect = Effect.fn("cli.checkpoint.connect")(function* (name?: string) {
  if (name !== undefined && !Schema.is(BoltCheckpoint.Name)(name))
    return yield* Effect.fail(
      new Error(`Invalid checkpoint name "${name}". Use letters, numbers, dots, dashes, or underscores.`),
    )
  const server = yield* ServerConnection.resolve()
  const client = OpenCode.make({
    baseUrl: server.endpoint.url,
    headers: Service.headers(server.endpoint),
    fetch: noTimeoutFetch,
  })
  return { client, rpc: client.rpc(BoltCheckpoint.Definition), options: { location: { directory: process.cwd() } } }
})

export function age(now: number, time: number) {
  const seconds = Math.max(0, Math.floor((now - time) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
