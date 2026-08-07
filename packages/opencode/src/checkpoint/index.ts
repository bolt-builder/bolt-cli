import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer, Schema } from "effect"
import { InstanceState } from "@/effect/instance-state"
import { Snapshot } from "@/snapshot"
import { Storage } from "@/storage/storage"
import { Session } from "@/session/session"
import { SessionRevert } from "@/session/revert"
import { SessionID, MessageID } from "@/session/schema"

export const Info = Schema.Struct({
  name: Schema.String,
  time: Schema.Finite,
  snapshot: Schema.String,
  sessionID: Schema.optional(SessionID),
  messageID: Schema.optional(MessageID),
}).annotate({ identifier: "Checkpoint" })
export type Info = Schema.Schema.Type<typeof Info>

export class NameError extends Schema.TaggedErrorClass<NameError>()("CheckpointNameError", {
  name: Schema.String,
}) {}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("CheckpointNotFoundError", {
  name: Schema.String,
}) {}

export class DisabledError extends Schema.TaggedErrorClass<DisabledError>()("CheckpointDisabledError", {}) {}

/** Checkpoint names are file-safe slugs so they can double as storage keys. */
export function validName(name: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)
}

/**
 * First id created strictly after the checkpoint marker. Message IDs are
 * lexicographically ascending, so everything from this id onward was produced
 * after the checkpoint was saved and gets rewound.
 */
export function next<T extends string>(ids: readonly T[], last: string) {
  return ids.find((id) => id > last)
}

export interface Interface {
  readonly save: (input: {
    name: string
    sessionID?: SessionID
  }) => Effect.Effect<Info, NameError | DisabledError | Session.NotFound>
  readonly list: () => Effect.Effect<Info[]>
  readonly rewind: (name: string) => Effect.Effect<Info, NotFoundError | Session.BusyError>
  readonly remove: (name: string) => Effect.Effect<void, NotFoundError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Checkpoint") {}

function key(projectID: string, name?: string) {
  if (name === undefined) return ["checkpoint", projectID]
  return ["checkpoint", projectID, name]
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const storage = yield* Storage.Service
    const snapshot = yield* Snapshot.Service
    const sessions = yield* Session.Service
    const revert = yield* SessionRevert.Service

    const save = Effect.fn("Checkpoint.save")(function* (input: { name: string; sessionID?: SessionID }) {
      if (!validName(input.name)) return yield* new NameError({ name: input.name })
      const ctx = yield* InstanceState.context
      const hash = yield* snapshot.track()
      if (!hash) return yield* new DisabledError()
      const marker = yield* Effect.gen(function* () {
        if (!input.sessionID) return undefined
        const messages = yield* sessions.messages({ sessionID: input.sessionID })
        return { sessionID: input.sessionID, messageID: messages.at(-1)?.info.id }
      })
      const info: Info = {
        name: input.name,
        time: Date.now(),
        snapshot: hash,
        ...(marker?.sessionID ? { sessionID: marker.sessionID } : {}),
        ...(marker?.messageID ? { messageID: marker.messageID } : {}),
      }
      yield* storage.write(key(ctx.project.id, input.name), info).pipe(Effect.orDie)
      return info
    })

    const list = Effect.fn("Checkpoint.list")(function* () {
      const ctx = yield* InstanceState.context
      const keys = yield* storage.list(key(ctx.project.id)).pipe(Effect.catch(() => Effect.succeed([] as string[][])))
      const infos = yield* Effect.forEach(keys, (item) =>
        storage.read<Info>(item).pipe(Effect.catch(() => Effect.succeed(undefined))),
      )
      return infos.filter((item): item is Info => item !== undefined).toSorted((a, b) => b.time - a.time)
    })

    const rewind = Effect.fn("Checkpoint.rewind")(function* (name: string) {
      const ctx = yield* InstanceState.context
      const info = yield* storage
        .read<Info>(key(ctx.project.id, name))
        .pipe(Effect.catch(() => Effect.fail(new NotFoundError({ name }))))
      if (info.sessionID && info.messageID) {
        const messages = yield* sessions.messages({ sessionID: info.sessionID }).pipe(Effect.orDie)
        const target = next(
          messages.map((message) => message.info.id),
          info.messageID,
        )
        if (target) yield* revert.revert({ sessionID: info.sessionID, messageID: target })
      }
      // Restore after the conversation revert so the working tree ends up in
      // the exact state captured by the checkpoint, not the patch-based
      // approximation the revert produces.
      yield* snapshot.restore(info.snapshot)
      return info
    })

    const remove = Effect.fn("Checkpoint.remove")(function* (name: string) {
      const ctx = yield* InstanceState.context
      yield* storage
        .read<Info>(key(ctx.project.id, name))
        .pipe(Effect.catch(() => Effect.fail(new NotFoundError({ name }))))
      yield* storage.remove(key(ctx.project.id, name)).pipe(Effect.orDie)
    })

    return Service.of({ save, list, rewind, remove })
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer: layer,
  deps: [Storage.node, Snapshot.node, Session.node, SessionRevert.node],
})

export * as Checkpoint from "."
