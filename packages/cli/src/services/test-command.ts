import { Effect, Stream } from "effect"
import { ChildProcess } from "effect/process"
import { AppProcess } from "@opencode/util/process"

/** Drain both streams while retaining the failure tail used by repair prompts. */
export const runTestCommand = Effect.fn("cli.runTestCommand")(function* (command: string, cwd: string) {
  const app = yield* AppProcess.Service
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* app.spawn(ChildProcess.make(command, { shell: true, cwd }))
      const collect = (stream: typeof handle.stdout) =>
        Stream.runFold(
          stream,
          () => ({ buffer: Buffer.alloc(0), truncated: false }),
          (previous, chunk) => ({
            buffer: Buffer.concat([previous.buffer, chunk]).subarray(-10_000),
            truncated: previous.truncated || previous.buffer.length + chunk.length > 10_000,
          }),
        ).pipe(Effect.map((result) => `${result.truncated ? "[output truncated]\n" : ""}${result.buffer.toString()}`))
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [collect(handle.stdout), collect(handle.stderr), handle.exitCode],
        { concurrency: "unbounded" },
      )
      return { stdout, stderr, exitCode }
    }),
  )
})
