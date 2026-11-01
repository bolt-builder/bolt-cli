import { Effect, Option } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"

export default Runtime.handler(Commands.commands.run, (input) =>
  Effect.gen(function* () {
    if (input.background) {
      const { spawnJob } = yield* Effect.promise(() => import("./jobs"))
      const separator = process.argv.indexOf("--", 2)
      const options = process.argv
        .slice(2, separator === -1 ? undefined : separator)
        .filter((arg) => !["--background", "--bg", "--background=true", "--bg=true"].includes(arg))
      const job = yield* Effect.tryPromise({
        try: () => spawnJob([...options, ...(separator === -1 ? [] : process.argv.slice(separator))], process.cwd()),
        catch: (cause) => cause,
      })
      process.stdout.write(
        `Started background job ${job.id} (pid ${job.pid}).\nTail it with: bolt jobs tail ${job.id} --follow\n`,
      )
      return
    }
    const { reportRunError, runNonInteractive } = yield* Effect.promise(() => import("../../run/run"))
    const separator = process.argv.indexOf("--", 2)
    const server = yield* ServerConnection.resolve().pipe(
      Effect.tapError((error) => Effect.logError("run could not resolve its server", { cause: error })),
      Effect.catch((error) => Effect.sync(() => reportRunError(input, error.message))),
    )
    if (!server) return
    const transcript = input.voice
      ? yield* Effect.tryPromise(async () => {
          const { capture } = await import("../../services/voice")
          return capture(server)
        }).pipe(
          Effect.catch((error) =>
            Effect.sync(() => {
              reportRunError(input, error instanceof Error ? error.message : String(error))
              return undefined
            }),
          ),
        )
      : ""
    if (transcript === undefined) return
    yield* Effect.promise(() =>
      runNonInteractive({
        server,
        message: [
          ...input.message,
          ...(transcript ? [transcript] : []),
          ...(separator === -1 ? [] : process.argv.slice(separator + 1)),
        ],
        continue: input.continue,
        session: Option.getOrUndefined(input.session),
        fork: input.fork,
        worktree: Option.getOrUndefined(input.worktree),
        model: Option.getOrUndefined(input.model),
        agent: Option.getOrUndefined(input.agent),
        format: input.format,
        file: [...input.file],
        title: Option.getOrUndefined(input.title),
        thinking: input.thinking,
        auto: input.auto || input.yolo || input.dangerouslySkipPermissions,
      }),
    )
  }),
)
