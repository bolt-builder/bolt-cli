import fs from "node:fs"
import path from "node:path"
import { Effect, Option, Schema } from "effect"
import { SemanticIndex } from "@opencode/util/semantic-index"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { errorMessage } from "../../util/error"

const MAX_BYTES = 200_000

export default Runtime.handler(Commands.commands.index, (args) =>
  Effect.gen(function* () {
    const cwd = process.cwd()
    const out = path.resolve(cwd, args.out)
    const stored = yield* Effect.tryPromise({
      try: async () => {
        const file = Bun.file(out)
        if (!(await file.exists())) return { version: 1 as const, files: {} }
        return Schema.decodeUnknownPromise(SemanticIndex.Info)(await file.json())
      },
      catch: (cause) => cause,
    })
    const names = (yield* Effect.promise(() => Array.fromAsync(new Bun.Glob("**/*").scan({ cwd }))))
      .map((name) => name.replaceAll("\\", "/"))
      .filter(SemanticIndex.indexable)
      .sort()
    const files: Record<string, string> = {}
    for (const name of names) {
      const handle = Bun.file(path.join(cwd, name))
      if (handle.size > MAX_BYTES) continue
      files[name] = yield* Effect.tryPromise({ try: () => handle.text(), catch: (cause) => cause })
    }
    const first = SemanticIndex.refresh(stored, files)
    yield* Effect.tryPromise({ try: () => Bun.write(out, JSON.stringify(first.index)), catch: (cause) => cause })
    process.stderr.write(
      `Indexed ${Object.keys(first.index.files).length} files (+${first.stats.added} ~${first.stats.updated} -${first.stats.removed} =${first.stats.unchanged}) to ${args.out}\n`,
    )
    if (Option.isSome(args.query))
      process.stdout.write(
        SemanticIndex.render(SemanticIndex.query(first.index, args.query.value, Math.max(1, args.limit))),
      )
    if (!args.watch) return

    let current = first.index
    let notify: (() => void) | undefined
    const changed = new Set<string>()
    yield* Effect.acquireRelease(
      Effect.try(() =>
        fs.watch(cwd, { recursive: true }, (_, name) => {
          if (!name) return
          const clean = name.replaceAll("\\", "/")
          if (!SemanticIndex.indexable(clean)) return
          changed.add(clean)
          notify?.()
        }),
      ),
      (watcher) =>
        Effect.sync(() => {
          watcher.close()
          notify = undefined
        }),
    )
    process.stderr.write("Watching for saves, ctrl-c to stop\n")
    while (true) {
      yield* Effect.callback<void>((resume) => {
        if (changed.size > 0) {
          resume(Effect.void)
          return
        }
        notify = () => resume(Effect.void)
        return Effect.sync(() => {
          notify = undefined
        })
      })
      yield* Effect.sleep("200 millis")
      const batch = [...changed]
      changed.clear()
      for (const name of batch) {
        const handle = Bun.file(path.join(cwd, name))
        if (!(yield* Effect.promise(() => handle.exists())) || handle.size > MAX_BYTES) {
          delete files[name]
          continue
        }
        files[name] = yield* Effect.tryPromise({ try: () => handle.text(), catch: (cause) => cause })
      }
      const result = SemanticIndex.refresh(current, files)
      current = result.index
      yield* Effect.tryPromise({ try: () => Bun.write(out, JSON.stringify(current)), catch: (cause) => cause })
      process.stderr.write(
        `Reindexed (+${result.stats.added} ~${result.stats.updated} -${result.stats.removed} =${result.stats.unchanged})\n`,
      )
    }
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
