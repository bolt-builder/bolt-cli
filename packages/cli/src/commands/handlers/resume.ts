import { autocomplete } from "@clack/prompts"
import { Effect, Option } from "effect"
import { OpenCode, type SessionInfo } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { InteractiveSession } from "../../services/interactive-session"
import { handlePromptErrors, prompt, requireInteractive } from "../../ui/prompt"

// fzf-style subsequence match: every query character (spaces ignored) must
// appear in order. The score sums the gaps between matched characters, so
// earlier and denser matches rank first; undefined means no match.
export function fuzzy(query: string, text: string): number | undefined {
  const target = text.toLowerCase()
  let score = 0
  let last = -1
  for (const char of query.toLowerCase()) {
    if (char === " ") continue
    const index = target.indexOf(char, last + 1)
    if (index < 0) return undefined
    score += index - last - 1
    last = index
  }
  return score
}

// Filters and sorts picker options by fuzzy score against label and hint,
// preserving the incoming order (most recent first) between equal scores.
export function rank<T extends { label: string; hint?: string }>(query: string, options: T[]): T[] {
  return options
    .flatMap((option) => {
      const score = fuzzy(query, option.hint ? `${option.label} ${option.hint}` : option.label)
      return score === undefined ? [] : [{ option, score }]
    })
    .sort((a, b) => a.score - b.score)
    .map((item) => item.option)
}

export default Runtime.handler(Commands.commands.resume, (input) =>
  handlePromptErrors(
    Effect.gen(function* () {
      yield* requireInteractive("bolt resume requires an interactive terminal")
      const server = yield* ServerConnection.resolve({ mismatch: "replace" })
      const client = OpenCode.make({ baseUrl: server.endpoint.url, headers: Service.headers(server.endpoint) })
      const id = yield* Effect.gen(function* () {
        const requested = Option.getOrUndefined(input.sessionID)
        if (requested) {
          const session = yield* Effect.tryPromise({
            try: () => client.session.get({ sessionID: requested }),
            catch: (cause) => cause,
          })
          return session.id
        }
        const sessions = yield* Effect.tryPromise({
          try: async () => {
            const found: SessionInfo[] = []
            let cursor: string | undefined
            do {
              const page = await client.session.list({ parentID: null, order: "desc", limit: 100, cursor })
              found.push(...page.data)
              cursor = page.cursor.next ?? undefined
            } while (cursor)
            return found.sort((a, b) => b.time.updated - a.time.updated)
          },
          catch: (cause) => cause,
        })
        if (!sessions.length) return yield* Effect.fail(new Error("No sessions found"))
        const options = sessions.map((session) => ({
          label: session.title ?? "Untitled session",
          value: session.id,
          hint: `${new Date(session.time.updated).toLocaleString()} • ${session.id.slice(-8)}`,
        }))
        return yield* prompt<string>(() =>
          autocomplete({
            message: "Resume session",
            maxItems: 10,
            options() {
              return rank(this.userInput, options)
            },
          }),
        )
      })
      yield* InteractiveSession.resume(server, id)
    }),
  ),
)
