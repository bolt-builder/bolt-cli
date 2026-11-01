import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { tournament } from "../../services/tournament"
import { readStdin } from "../../util/io"
import { errorMessage } from "../../util/error"

export default Runtime.handler(Commands.commands.arena, (input) =>
  Effect.gen(function* () {
    const message = [...input.message, ...(process.stdin.isTTY ? [] : [yield* Effect.promise(() => readStdin())])]
      .filter(Boolean)
      .join("\n")
      .trim()
    if (!message) return yield* Effect.fail(new Error("You must provide a message"))
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    const result = yield* Effect.tryPromise(() =>
      tournament({
        client,
        message,
        models: input.models,
        judge: Option.getOrUndefined(input.judge),
        variant: Option.getOrUndefined(input.variant),
        agent: Option.getOrUndefined(input.agent),
        directory: process.cwd(),
        arena: true,
        cleanup: input.cleanup,
        auto: input.auto || input.yolo || input.dangerouslySkipPermissions,
      }),
    )
    if (input.format === "json") process.stdout.write(JSON.stringify(result) + "\n")
    else {
      for (const label of result.ranking) {
        const item = result.candidates.find((item) => item.label === label)!
        process.stderr.write(
          `${label === result.winner?.label ? "★" : "·"} ${label} · ${item.model} · ${item.worktree?.directory ?? ""}\n`,
        )
      }
      for (const item of result.candidates.filter((item) => item.error))
        process.stderr.write(`${item.label}: ${item.error}\n`)
      process.stdout.write((result.winner?.text ?? "") + "\n")
    }
    if (!result.winner || result.cleanupFailed) process.exitCode ||= 1
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
