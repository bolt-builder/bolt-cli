export * as Instance from "./service.js"
export type { Services } from "../instance.js"

import { Context, type Effect } from "effect"
import type { Session } from "@bolt-ai/schema/session"
import { Node } from "@bolt-ai/util/effect/app-node"
import { LayerNode } from "@bolt-ai/util/effect/layer-node"
import type { Services, Error } from "../instance.js"

/** Selects Session capabilities; implementations own caching and lifetime. */
export interface Interface {
  readonly provide: (
    session: Session.Info,
  ) => <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E | Error, Exclude<R, Services>>
}

export class Service extends Context.Service<Service, Interface>()("@bolt-ai/Instance") {}

export const node = LayerNode.unbound(Service, Node.tags.values.global)
