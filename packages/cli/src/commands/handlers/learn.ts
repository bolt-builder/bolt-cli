import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { BoltMemory } from "@opencode/schema/bolt-memory"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { execute } from "../../services/answer"
import { errorMessage } from "../../util/error"
import { validModel } from "./ask"

/** Count verified memory writes, including writes made before the final assistant step. */
export function saved(tools: readonly { name: string; metadata?: Record<string, unknown> }[]) {
  const done = tools.filter((tool) => tool.name === "memory_save")
  return {
    count: done.length,
    sources: [
      ...new Set(
        done.flatMap((tool) => {
          const sources = tool.metadata?.sources
          return Array.isArray(sources) ? sources.filter((item): item is string => typeof item === "string") : []
        }),
      ),
    ],
  }
}

const INSTRUCTIONS = [
  "Analyze this repository's conventions using your read, grep, glob, and bash tools. Cover:",
  "- naming (files, variables, functions, exports)",
  "- formatting and code style",
  "- error handling patterns",
  "- test patterns (framework, file layout, assertion style)",
  "- commit style (inspect recent subjects with `git log --format=%s -30`)",
  "- directory layout and module organization",
  "Ground every finding in files you actually read; skip areas the repository has no evidence for.",
  'Persist each durable convention with the memory_save tool: action "remember", one concise self-contained entry per convention, phrased as a rule future sessions can follow.',
  "Do not save one-off observations, secrets, or anything specific to uncommitted work.",
  "End with a short markdown summary of the conventions you saved, grouped by area.",
].join("\n")

export default Runtime.handler(Commands.commands.learn, (input) =>
  Effect.gen(function* () {
    const model = Option.getOrUndefined(input.model)
    if (model && !validModel(model))
      return yield* Effect.fail(new Error("Provide --model in the format provider/model."))
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    yield* Effect.tryPromise({
      try: async () => {
        const detected = await client
          .rpc(BoltMemory.Definition)
          .manage({ action: "learn" }, { location: { directory: process.cwd() } })
        process.stderr.write(detected.text + "\nLearning repository conventions...\n")
        const result = await execute({ client, text: INSTRUCTIONS, agent: "build", model, title: "bolt learn" })
        process.stdout.write(result.text + "\n")
        const writes = saved(result.tools)
        if (!writes.count && !detected.count)
          throw new Error("The run finished without saving any conventions to project memory.")
        process.stderr.write(
          writes.count
            ? `Saved ${writes.count} convention ${writes.count === 1 ? "entry" : "entries"}${writes.sources.length ? ` (${writes.sources.join(", ")})` : ""} to project memory at ${detected.root}\n`
            : `The model pass saved nothing new, but ${detected.count} auto-learned commands persisted to project memory at ${detected.root}\n`,
        )
        process.stderr.write("New sessions in this project will start with these conventions via memory recall.\n")
      },
      catch: (cause) => cause,
    })
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
