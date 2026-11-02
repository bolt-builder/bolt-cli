export * as SessionReplay from "./replay.js"

import type { LLMRequest } from "@opencode/ai/effect"
import { ContextReplay } from "@opencode/util/context-replay"
import { Global } from "@opencode/util/global"
import { Clock, Effect } from "effect"
import { Config } from "../config.js"

export const make = Effect.gen(function* () {
  const config = yield* Config.Service
  const global = yield* Global.Service
  return Effect.fn("SessionReplay.record")(function* (input: {
    sessionID: string
    messageID: string
    model: { providerID: string; modelID: string }
    request: LLMRequest
  }) {
    const enabled = (yield* config.entries())
      .flatMap((entry) => (entry.type === "document" ? [entry.info.experimental?.context_replay] : []))
      .findLast((value) => value !== undefined)
    if (enabled !== true) return
    const time = yield* Clock.currentTimeMillis
    const data = {
      version: 2,
      time,
      sessionID: input.sessionID,
      messageID: input.messageID,
      model: input.model,
      system: input.request.system,
      messages: input.request.messages,
      tools: input.request.tools.map((tool) => tool.name).sort(),
      toolDefinitions: input.request.tools,
      toolChoice: input.request.toolChoice,
      generation: input.request.generation,
    }
    yield* Effect.tryPromise(() => ContextReplay.record({ ...input, time }, data, global.data)).pipe(
      Effect.catch((error) => Effect.logWarning("Unable to record model context", { cause: error })),
    )
  })
})
