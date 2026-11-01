export * as ProcessPlugin from "./process.js"

import { define } from "@opencode/plugin/effect/plugin"
import { BoltProcess } from "@opencode/schema/bolt-process"
import { Effect, Option, Schema } from "effect"
import { Shell as ShellSchema } from "@opencode/schema/shell"
import { Shell } from "../shell.js"
import { Job } from "../job.js"

/** Exposes the existing V2 job registry to Bolt's process manager. */
export const Plugin = define({
  id: "bolt.process",
  effect: Effect.fn(function* (ctx) {
    const jobs = yield* Job.Service
    const shell = yield* Shell.Service
    yield* ctx.rpc
      .register(BoltProcess.Definition, {
        list: () => jobs.list.pipe(Effect.map((items) => items.map(portable))),
        output: ({ id }) =>
          Effect.gen(function* () {
            const job = yield* jobs.get(id)
            if (!job || job.type !== "shell") return null
            if (job.status !== "running") return job.output ?? null
            const parsed = Schema.decodeUnknownOption(ShellSchema.ID)(job.id)
            if (Option.isNone(parsed)) return null
            // Read just the newest 64 KiB from the active shell in this Location.
            const head = yield* shell.output(parsed.value, { cursor: 0, limit: 1 })
            const tail = yield* shell.output(parsed.value, { cursor: Math.max(0, head.size - 65_536), limit: 65_536 })
            return tail.output
          }).pipe(Effect.catchTag("Shell.NotFoundError", () => Effect.succeed(null))),
        cancel: ({ id }) => jobs.cancel(id).pipe(Effect.map((job) => (job ? portable(job) : null))),
      })
      .pipe(Effect.orDie)
  }),
})

function portable({ title, ...job }: Job.Info) {
  return title === undefined ? job : { ...job, title }
}
