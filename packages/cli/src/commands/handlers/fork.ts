import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { InteractiveSession } from "../../services/interactive-session"
import { requireInteractive } from "../../ui/prompt"
import { errorMessage } from "../../util/error"

export default Runtime.handler(Commands.commands.fork, (input) =>
  Effect.gen(function* () {
    if (input.resume) yield* requireInteractive("--resume requires an interactive terminal")
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({ baseUrl: server.endpoint.url, headers: Service.headers(server.endpoint) })
    const anchor = Option.getOrUndefined(input.messageID)
    const before = yield* Effect.tryPromise({
      try: async () => {
        if (!anchor) return undefined
        let cursor: string | undefined
        let found = false
        do {
          const page = await client.message.list({
            sessionID: input.sessionID,
            limit: 100,
            ...(cursor ? { cursor } : { order: "asc" }),
          })
          for (const message of page.data) {
            if (found) return message.id
            if (message.id === anchor) found = true
          }
          cursor = page.cursor.next ?? undefined
        } while (cursor)
        if (!found) throw new Error(`Message not found in session: ${anchor}`)
        return undefined
      },
      catch: (cause) => cause,
    })
    // V2 accepts an exclusive `before` boundary. The next message preserves V1's inclusive anchor.
    const session = yield* Effect.tryPromise({
      try: () => client.session.fork({ sessionID: input.sessionID, before }),
      catch: (cause) => cause,
    })
    process.stdout.write(`Forked into ${session.id} ${session.title ?? "Untitled session"}\n`)
    if (!input.resume) {
      process.stdout.write(`Continue it with: bolt run --session ${session.id} "<prompt>"\n`)
      return
    }
    yield* InteractiveSession.resume(server, session.id)
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
