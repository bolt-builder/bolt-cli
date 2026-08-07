import { EOL } from "os"
import { Effect } from "effect"
import { effectCmd, fail } from "../effect-cmd"

/** Combine the question with any piped stdin so the model sees both. */
export function compose(question: string, piped?: string) {
  const context = piped?.trim()
  if (!context) return question
  return `${question}\n\nContext:\n${context}`
}

export const AskCommand = effectCmd({
  command: "ask <question..>",
  describe: "ask a one-shot question and print only the answer to stdout",
  builder: (yargs) =>
    yargs
      .positional("question", {
        type: "string",
        array: true,
        demandOption: true,
        describe: "the question to ask",
      })
      .option("model", {
        alias: "m",
        type: "string",
        describe: "model to use in the format of provider/model",
      })
      .option("agent", {
        type: "string",
        describe: "agent to answer with",
      }),
  handler: Effect.fn("Cli.ask")(function* (args) {
    const question = args.question.join(" ").trim()
    if (!question) return yield* fail("Provide a question to ask.")
    const piped = process.stdin.isTTY ? undefined : yield* Effect.promise(() => Bun.stdin.text())

    const { Session } = yield* Effect.promise(() => import("@/session/session"))
    const { SessionPrompt } = yield* Effect.promise(() => import("@/session/prompt"))
    const { MessageID, PartID } = yield* Effect.promise(() => import("../../session/schema"))
    const { parseModel } = yield* Effect.promise(() => import("@/provider/provider"))
    const { extractResponseText } = yield* Effect.promise(() => import("./github.shared"))
    const sessions = yield* Session.Service
    const prompt = yield* SessionPrompt.Service
    const session = yield* sessions.create({
      title: "bolt ask",
      permission: [{ permission: "question", action: "deny", pattern: "*" }],
    })

    const result = yield* prompt
      .prompt({
        sessionID: session.id,
        messageID: MessageID.ascending(),
        agent: args.agent,
        model: args.model ? parseModel(args.model) : undefined,
        parts: [
          {
            id: PartID.ascending(),
            type: "text",
            text: compose(question, piped),
          },
        ],
      })
      .pipe(Effect.orDie)

    if (result.info.role === "assistant" && result.info.error) {
      const err = result.info.error
      const message = "message" in err.data ? err.data.message : ""
      return yield* fail(`${err.name}: ${message}`)
    }

    const text = extractResponseText(result.parts) ?? ""
    if (!text) return yield* fail("The model returned an empty answer.")
    process.stdout.write(text.trim() + EOL)
  }),
})
