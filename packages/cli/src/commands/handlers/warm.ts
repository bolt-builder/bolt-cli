import path from "node:path"
import { Effect, Schema } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { SemanticIndex } from "@opencode/util/semantic-index"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"

export function elapsed(start: number, end: number) {
  return `${Math.max(0, Math.round(end - start))}ms`
}

export default Runtime.handler(Commands.commands.warm, (input) =>
  Effect.gen(function* () {
    const begin = performance.now()
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    const location = { directory: process.cwd() }
    yield* Effect.tryPromise({ try: () => client.location.get({ location }), catch: (cause) => cause })
    process.stdout.write(`✓ project instance ${elapsed(begin, performance.now())}\n`)
    const configStart = performance.now()
    yield* Effect.tryPromise({ try: () => client.config.get({ location }), catch: (cause) => cause })
    process.stdout.write(`✓ config ${elapsed(configStart, performance.now())}\n`)
    const modelsStart = performance.now()
    yield* Effect.tryPromise({ try: () => client.model.list({ location }), catch: (cause) => cause })
    process.stdout.write(`✓ models catalog ${elapsed(modelsStart, performance.now())}\n`)
    if (input.index) {
      const start = performance.now()
      const out = path.join(location.directory, "codebase-index.json")
      const stored = yield* Effect.tryPromise({
        try: async () =>
          (await Bun.file(out).exists())
            ? Schema.decodeUnknownPromise(SemanticIndex.Info)(await Bun.file(out).json())
            : { version: 1 as const, files: {} },
        catch: (cause) => cause,
      })
      const names = (yield* Effect.promise(() =>
        Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: location.directory })),
      ))
        .map((name) => name.replaceAll("\\", "/"))
        .filter(SemanticIndex.indexable)
        .sort()
      const files: Record<string, string> = {}
      for (const name of names) {
        const file = Bun.file(path.join(location.directory, name))
        if (file.size <= 200_000)
          files[name] = yield* Effect.tryPromise({ try: () => file.text(), catch: (cause) => cause })
      }
      const result = SemanticIndex.refresh(stored, files)
      yield* Effect.tryPromise({ try: () => Bun.write(out, JSON.stringify(result.index)), catch: (cause) => cause })
      process.stdout.write(
        `✓ vector index: ${Object.keys(result.index.files).length} files (+${result.stats.added} ~${result.stats.updated} -${result.stats.removed}) ${elapsed(start, performance.now())}\n`,
      )
    }
    process.stdout.write(`warm complete ${elapsed(begin, performance.now())}\n`)
  }),
)
