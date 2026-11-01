export * as RedactPlugin from "./redact.js"

import { Message } from "@opencode/ai/effect"
import { define } from "@opencode/plugin/effect/plugin"
import type { SessionRequest } from "@opencode/plugin/effect/session"
import { Redact } from "@opencode/util/redact"
import { Effect } from "effect"
import { Config } from "../config.js"

export const Plugin = define({
  id: "bolt.redact",
  effect: Effect.fn(function* (ctx) {
    const config = yield* Config.Service
    const hook = (event: SessionRequest) =>
      Effect.gen(function* () {
        const enabled = (yield* config.entries())
          .flatMap((entry) => (entry.type === "document" ? [entry.info.experimental?.redact ?? entry.info.redact] : []))
          .findLast((value) => value !== undefined)
        if (enabled === false) return
        event.system = Redact.deep(event.system)
        // Messages are V2 schema class instances. Redact their fields explicitly,
        // preserving the utility's contract to leave opaque class instances alone.
        event.messages = event.messages.map((message) => new Message(Redact.deep({ ...message })))
      })
    yield* ctx.session.hook("context", hook)
    yield* ctx.session.hook("compaction", hook)
    yield* ctx.session.hook("generate", hook)
    yield* ctx.session.hook("title", hook)
  }),
})
