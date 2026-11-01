import { autocomplete, cancel, intro, isCancel, log, outro } from "@clack/prompts"
import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/effect/service"
import { Effect, Option } from "effect"
import { EOL } from "node:os"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { ServerConnection } from "../../../services/server-connection"
import { Envelope } from "../../../util/envelope"
import { Porcelain } from "../../../util/porcelain"
import { turns } from "../../../services/transcript"
import { errorMessage } from "../../../util/error"

export default Runtime.handler(
  Commands.commands.session.commands.export,
  Effect.fn("cli.session.export")((input) =>
    Effect.gen(function* () {
      if ([input.html, input.md, input.jsonl, input.json, input.porcelain].filter(Boolean).length > 1)
        return yield* Effect.fail(
          new Error("Choose only one export format: --html, --md, --jsonl, --json or --porcelain"),
        )
      const requested = Option.getOrUndefined(input.session)
      if (!requested && !process.stdin.isTTY) {
        yield* Effect.fail(new Error("Pass a session ID when running without an interactive terminal"))
      }
      const server = yield* ServerConnection.resolve()
      const client = OpenCode.make({
        baseUrl: server.endpoint.url,
        headers: Service.headers(server.endpoint),
      })
      const sessionID = requested
        ? requested
        : yield* Effect.gen(function* () {
            intro("Export session", { output: process.stderr })
            const location = yield* Effect.tryPromise({
              try: () => client.location.get({ location: { directory: process.cwd() } }),
              catch: (cause) => cause,
            })
            const page = yield* Effect.tryPromise({
              try: () =>
                client.session.list({
                  directory: location.directory,
                  parentID: null,
                  order: "desc",
                  limit: 50,
                }),
              catch: (cause) => cause,
            })
            if (page.data.length === 0) {
              log.error("No sessions found", { output: process.stderr })
              outro("Done", { output: process.stderr })
              return undefined
            }
            const selected = yield* Effect.tryPromise({
              try: () =>
                autocomplete({
                  message: "Select session to export",
                  maxItems: 10,
                  options: page.data.map((session) => ({
                    label: session.title,
                    value: session.id,
                    hint: `${new Date(session.time.updated).toLocaleString()} - ${session.id.slice(-8)}`,
                  })),
                  output: process.stderr,
                }),
              catch: (cause) => cause,
            })
            if (isCancel(selected)) {
              cancel("Cancelled", { output: process.stderr })
              process.exitCode = 130
              return undefined
            }
            outro("Exporting session...", { output: process.stderr })
            return selected
          })
      if (!sessionID) return
      const data = yield* Effect.tryPromise({
        try: () => client.experimental.session.export({ sessionID, sanitize: input.sanitize }),
        catch: (cause) => cause,
      })
      if (input.html) {
        const { render } = yield* Effect.promise(() => import("../export-html"))
        yield* Effect.promise(() =>
          Bun.write(input.out, render(data.info.title ?? "Untitled session", turns(data.messages))),
        )
        process.stderr.write(`Wrote replay to ${input.out}\n`)
        return
      }
      if (input.md) {
        const { markdown } = yield* Effect.promise(() => import("../export-md"))
        process.stdout.write(markdown(data.info.title ?? "Untitled session", turns(data.messages)))
        return
      }
      if (input.jsonl) {
        for (const message of data.messages) process.stdout.write(JSON.stringify(message) + EOL)
        return
      }
      if (input.json) {
        Envelope.print(data)
        return
      }
      if (input.porcelain) {
        Porcelain.print("session", data.info.id, data.info.title ?? "Untitled session")
        for (const turn of turns(data.messages))
          Porcelain.print(
            "message",
            turn.info.id,
            turn.info.role,
            turn.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n"),
          )
        return
      }
      process.stdout.write(JSON.stringify(data, null, 2) + EOL)
    }).pipe(
      Effect.catch((error) =>
        Effect.sync(() => {
          process.stderr.write(errorMessage(error) + EOL)
          process.exitCode = 1
        }),
      ),
    ),
  ),
)
