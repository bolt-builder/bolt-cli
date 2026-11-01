import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { BoltMemory } from "@opencode/schema/bolt-memory"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Effect } from "effect"
import { ServerConnection } from "../../../services/server-connection"
import { errorMessage } from "../../../util/error"
import { validModel } from "../ask"

const connection = Effect.gen(function* () {
  const server = yield* ServerConnection.resolve()
  const client = OpenCode.make({
    baseUrl: server.endpoint.url,
    headers: Service.headers(server.endpoint),
    fetch: noTimeoutFetch,
  })
  return { client, rpc: client.rpc(BoltMemory.Definition), options: { location: { directory: process.cwd() } } }
})

export const run = (
  input: typeof BoltMemory.Management.Type | (() => Promise<typeof BoltMemory.Management.Type>),
  out?: string,
) =>
  Effect.gen(function* () {
    const { rpc, options } = yield* connection
    yield* Effect.tryPromise({
      try: async () => {
        const result = await rpc.manage(typeof input === "function" ? await input() : input, options)
        if (!out) {
          process.stdout.write(result.text + "\n")
          return
        }
        await Bun.write(out, result.text)
        process.stderr.write(`Exported ${result.count ?? 0} memory entries to ${out}\n`)
      },
      catch: (cause) => cause,
    })
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode = 1
      }),
    ),
  )

export const why = (question: string, model?: string) =>
  Effect.gen(function* () {
    if (!question.trim()) return yield* Effect.fail(new Error("Provide a question to ask stored memory."))
    if (model && !validModel(model))
      return yield* Effect.fail(new Error("Provide --model in the format provider/model."))
    const { client, rpc, options } = yield* connection
    yield* Effect.tryPromise({
      try: async () => {
        const evidence = await rpc.manage({ action: "dossier" }, options)
        const capped =
          evidence.text.length > 120_000 ? evidence.text.slice(0, 120_000) + "\n[dossier truncated]" : evidence.text
        process.stderr.write("Asking stored memory...\n")
        const selected = model
          ? { providerID: model.slice(0, model.indexOf("/")), id: model.slice(model.indexOf("/") + 1) }
          : (await client.model.default({ location: options.location })).data
        if (!selected) throw new Error("No model available. Connect a provider or pass --model provider/model.")
        const result = await client.experimental.generate.text({
          prompt: `${INSTRUCTIONS}\n\nQuestion:\n${question}\n\nMemory dossier:\n${capped}`,
          model: { providerID: selected.providerID, id: selected.id },
        })
        if (!result.text.trim()) throw new Error("The model returned an empty answer.")
        process.stdout.write(result.text.trim() + "\n")
      },
      catch: (cause) => cause,
    })
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode = 1
      }),
    ),
  )

const INSTRUCTIONS = [
  "You are answering a question about this project's stored agent memory.",
  "Use only the memory dossier below as evidence. Do not use tools, read repository files, or invent memories.",
  "Answer the question, then cite the specific memory entries that support the answer: quote each supporting entry verbatim and name its file, section, and key.",
  "When an entry carries metadata such as an updated date or a session id, state where and when it was learned.",
  "If nothing in the dossier supports an answer, say plainly that stored memory does not cover it.",
].join("\n")
