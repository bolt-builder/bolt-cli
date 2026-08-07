import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer } from "effect"
import { Config } from "@/config/config"
import { InstanceState } from "@/effect/instance-state"
import type { SessionID } from "./schema"

export interface Verdict {
  used: number
  limit?: number
  allowed: boolean
}

export interface Interface {
  /** Count one attempted call of a tool in a session and decide whether it fits the configured budget. */
  readonly consume: (input: { sessionID: SessionID; tool: string }) => Effect.Effect<Verdict>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionToolBudget") {}

/** A call is allowed while its ordinal stays within the limit; no limit means unlimited. */
export function verdict(used: number, limit?: number): Verdict {
  if (limit === undefined) return { used, allowed: true }
  return { used, limit, allowed: used <= limit }
}

const layer: Layer.Layer<Service, never, Config.Service> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const state = yield* InstanceState.make(() => Effect.succeed(new Map<string, number>()))

    const consume = Effect.fn("SessionToolBudget.consume")(function* (input: { sessionID: SessionID; tool: string }) {
      const cfg = yield* config.get().pipe(Effect.orDie)
      const counters = yield* InstanceState.get(state)
      const key = `${input.sessionID}\u0000${input.tool}`
      const used = (counters.get(key) ?? 0) + 1
      const result = verdict(used, cfg.tool_budget?.[input.tool])
      // Denied calls do not consume budget, so the counter stays at the limit.
      if (result.allowed) counters.set(key, used)
      return result
    })

    return Service.of({ consume })
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [Config.node],
})

export * as SessionToolBudget from "./tool-budget"
