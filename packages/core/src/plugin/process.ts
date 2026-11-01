export * as ProcessPlugin from "./process.js"

import { define } from "@opencode/plugin/effect/plugin"
import { BoltProcess } from "@opencode/schema/bolt-process"
import { Effect } from "effect"
import { Job } from "../job.js"

/** Exposes the existing V2 job registry to Bolt's process manager. */
export const Plugin = define({
  id: "bolt.process",
  effect: Effect.fn(function* (ctx) {
    const jobs = yield* Job.Service
    yield* ctx.rpc
      .register(BoltProcess.Definition, {
        list: () => jobs.list.pipe(Effect.map((items) => items.map(portable))),
        cancel: ({ id }) => jobs.cancel(id).pipe(Effect.map((job) => (job ? portable(job) : null))),
      })
      .pipe(Effect.orDie)
  }),
})

function portable({ title, ...job }: Job.Info) {
  return title === undefined ? job : { ...job, title }
}
