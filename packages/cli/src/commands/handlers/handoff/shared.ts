import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { ServerConnection } from "../../../services/server-connection"

/** V2 handoff uses the existing projected-session import/export API. */
export function endpoint(value: string) {
  const url = URL.parse(value)
  if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined
  return url.origin
}

export function request<A>(run: () => Promise<A>) {
  return Effect.tryPromise({ try: run, catch: (cause) => cause })
}

export const clients = Effect.fn("cli.handoff.clients")(function* (input: {
  url: string
  password: Option.Option<string>
  username: Option.Option<string>
}) {
  const url = endpoint(input.url)
  if (!url) return yield* Effect.fail(new Error(`Invalid server URL: ${input.url}. Expected http(s)://host:port`))
  const server = yield* ServerConnection.resolve()
  const password =
    Option.getOrUndefined(input.password) ?? process.env.BOLT_SERVER_PASSWORD ?? process.env.OPENCODE_SERVER_PASSWORD
  const username = Option.getOrUndefined(input.username) ?? process.env.BOLT_SERVER_USERNAME ?? "opencode"
  return {
    local: OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    }),
    remote: OpenCode.make({
      baseUrl: url,
      headers:
        password === undefined ? undefined : Service.headers({ url, auth: { type: "basic", username, password } }),
      fetch: noTimeoutFetch,
    }),
  }
})
