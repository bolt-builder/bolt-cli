import { Effect, Option } from "effect"
import { OpenCode, isSessionNotFoundError } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { turns, type Part } from "../../services/transcript"
import { errorMessage } from "../../util/error"

export function build(pattern: string, insensitive: boolean): RegExp | undefined {
  try {
    return new RegExp(pattern, insensitive ? "i" : undefined)
  } catch {
    return undefined
  }
}

export function lines(parts: readonly Part[], regex: RegExp): string[] {
  return parts
    .flatMap((part) => {
      if (part.type === "text" || part.type === "reasoning") return part.text.split("\n")
      if (part.type === "tool" && part.state.status === "completed") return part.state.output.split("\n")
      return []
    })
    .filter((line) => regex.test(line))
}

export default Runtime.handler(Commands.commands.grep, (input) =>
  Effect.gen(function* () {
    const regex = build(input.pattern, input.ignoreCase)
    if (!regex) return yield* Effect.fail(new Error(`Invalid pattern: ${input.pattern}`))
    const limit = Option.getOrUndefined(input.limit)
    if (limit !== undefined && limit <= 0) return yield* Effect.fail(new Error("--limit must be a positive integer"))
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({ baseUrl: server.endpoint.url, headers: Service.headers(server.endpoint) })
    const hits = yield* Effect.tryPromise({
      try: async () => {
        const found: { sessionID: string; title: string; messageID: string; line: string }[] = []
        let cursor: string | undefined
        do {
          const page = await client.session.list({ limit: 100, order: "desc", cursor })
          for (const session of page.data) {
            let messageCursor: string | undefined
            do {
              const messages = await client.message
                .list({ sessionID: session.id, limit: 100, order: "asc", cursor: messageCursor })
                .catch((error: unknown) => {
                  if (isSessionNotFoundError(error)) return { data: [], cursor: { next: undefined } }
                  throw error
                })
              for (const turn of turns(messages.data))
                for (const line of lines(turn.parts, regex)) {
                  found.push({
                    sessionID: session.id,
                    title: session.title ?? "Untitled session",
                    messageID: turn.info.id,
                    line: line.trim(),
                  })
                  if (limit !== undefined && found.length >= limit) return found
                }
              messageCursor = messages.cursor.next ?? undefined
            } while (messageCursor)
          }
          cursor = page.cursor.next ?? undefined
        } while (cursor)
        return found
      },
      catch: (cause) => cause,
    })
    if (!hits.length) {
      process.exitCode = 1
      return
    }
    if (input.json) {
      process.stdout.write(JSON.stringify(hits, null, 2) + "\n")
      return
    }
    let previous = ""
    for (const hit of hits) {
      if (hit.sessionID !== previous) {
        previous = hit.sessionID
        process.stdout.write(`${hit.sessionID} ${hit.title}\n`)
      }
      process.stdout.write(`  ${hit.messageID}: ${hit.line}\n`)
    }
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
