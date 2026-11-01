import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { answer } from "../../services/answer"
import { errorMessage } from "../../util/error"
import { readStdin } from "../../util/io"

/** Combine the question with any piped stdin so the model sees both. */
export function compose(question: string, piped?: string) {
  const context = piped?.trim()
  if (!context) return question
  return `${question}\n\nContext:\n${context}`
}

/** True when a --model value has both a provider and a model component. */
export function validModel(model: string) {
  return /^[^/]+\/.+$/.test(model)
}

export default Runtime.handler(Commands.commands.ask, (input) =>
  Effect.gen(function* () {
    const question = input.question.join(" ").trim()
    if (!question) return yield* Effect.fail(new Error("Provide a question to ask."))
    const model = Option.getOrUndefined(input.model)
    if (model !== undefined && !validModel(model))
      return yield* Effect.fail(new Error("Provide --model in the format provider/model."))
    const piped = process.stdin.isTTY ? undefined : yield* Effect.promise(() => readStdin())
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    const text = yield* Effect.tryPromise({
      try: () =>
        answer({
          client,
          text: compose(question, piped),
          agent: Option.getOrElse(input.agent, () => "ask"),
          model,
          title: "bolt ask",
        }),
      catch: (cause) => cause,
    })
    process.stdout.write(text + "\n")
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
