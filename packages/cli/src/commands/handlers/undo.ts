import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"

/** Keep stacked undos strictly before the pending boundary. */
export function target<T extends string>(messages: readonly { id: T; role: string }[], marker?: string) {
  return messages.filter((item) => item.role === "user" && (!marker || item.id < marker)).at(-1)?.id
}

export default Runtime.handler(Commands.commands.undo, (input) =>
  Effect.gen(function* () {
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({ baseUrl: server.endpoint.url, headers: Service.headers(server.endpoint) })
    yield* Effect.tryPromise(async () => {
      const requested = Option.getOrUndefined(input.session)
      const session = requested
        ? await client.session.get({ sessionID: requested })
        : await client.location.get({ location: { directory: process.cwd() } }).then(async (location) => {
            const page = await client.session.list({
              project: location.project.id,
              parentID: null,
              order: "desc",
              limit: 1,
            })
            const latest = page.data[0]
            if (!latest) throw new Error("No sessions found in this project.")
            return latest
          })
      if (input.redo) {
        if (!session.revert) throw new Error("Nothing to redo: the session has no pending undo.")
        await client.session.revert.clear({ sessionID: session.id })
        process.stdout.write(`Restored session ${session.id} to its state before the undo.\n`)
        return
      }
      const messages = []
      let cursor: string | undefined
      do {
        const page = await client.message.list({
          sessionID: session.id,
          limit: 100,
          ...(cursor ? { cursor } : { order: "asc" as const }),
        })
        messages.push(...page.data)
        cursor = page.cursor.next ?? undefined
      } while (cursor)
      const messageID = target(
        messages.map((item) => ({ id: item.id, role: item.type })),
        session.revert?.messageID,
      )
      if (!messageID) throw new Error("Nothing to undo: no earlier user turn to rewind to.")
      const result = await client.session.revert.stage({ sessionID: session.id, messageID, files: true })
      const files = result.files ?? []
      const detail = files.length
        ? ` ${files.length} file${files.length === 1 ? "" : "s"} rolled back (+${files.reduce((sum, file) => sum + file.additions, 0)}/-${files.reduce((sum, file) => sum + file.deletions, 0)}).`
        : ""
      process.stdout.write(
        `Undid the last turn of session ${session.id}.${detail}\nThe undo stays pending until the conversation continues. Restore it with: bolt undo --redo\n`,
      )
    })
  }),
)
