export * as CheckpointPlugin from "./checkpoint.js"

import { define } from "@opencode/plugin/effect/plugin"
import { BoltCheckpoint } from "@opencode/schema/bolt-checkpoint"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { Hash } from "@opencode/util/hash"
import { Clock, Effect, Option, Schema } from "effect"
import path from "node:path"
import { KeyedMutex } from "../effect/keyed-mutex.js"
import { KV } from "../kv.js"
import { Location } from "../location.js"
import { Session } from "../session.js"
import { SessionMessage } from "../session/message.js"
import { Snapshot } from "../snapshot.js"

const locks = KeyedMutex.makeUnsafe<string>()
const decode = Schema.decodeUnknownOption(BoltCheckpoint.Info)

export const Plugin = define({
  id: "bolt.checkpoint",
  effect: Effect.fn(function* (ctx) {
    const kv = yield* KV.Service
    const fs = yield* FSUtil.Service
    const global = yield* Global.Service
    const location = yield* Location.Service
    const snapshot = yield* Snapshot.Service
    const sessions = yield* Session.Service
    const prefix = `bolt.checkpoint.v1/${location.project.id}/${Hash.fast(location.project.directory)}/`
    const migrate = Effect.fn("Checkpoint.migrate")(function* () {
      const marker = `${prefix}@imported`
      if (yield* kv.get(marker)) return
      const bolt = Global.boltDirectory(global.data)
      const imported = new Map<string, BoltCheckpoint.Info>()
      for (const data of [...(bolt ? [bolt] : []), global.data]) {
        const directory = path.join(data, "storage", "checkpoint", location.project.id)
        if (!(yield* fs.isDir(directory))) continue
        for (const name of yield* fs.readDirectory(directory)) {
          if (!name.endsWith(".json")) continue
          const info = Option.getOrUndefined(decode(yield* fs.readJson(path.join(directory, name))))
          if (!info || name !== `${info.name}.json`)
            return yield* Effect.fail(
              new Error(`Invalid V1 checkpoint: ${path.join(directory, name)}; source retained`),
            )
          imported.set(info.name, info)
        }
      }
      for (const info of imported.values())
        if ((yield* kv.get(prefix + info.name)) === undefined) yield* kv.set(prefix + info.name, { ...info })
      yield* kv.set(marker, true)
    })
    const get = Effect.fn("Checkpoint.get")(function* (name: string) {
      const info = Option.getOrUndefined(decode(yield* kv.get(prefix + name)))
      if (!info) return yield* Effect.fail(new Error(`No checkpoint named "${name}".`))
      return info
    })
    const session = Effect.fn("Checkpoint.session")(function* (id: string) {
      const current = yield* sessions.get(Session.ID.make(id))
      if (
        current.projectID !== location.project.id ||
        !FSUtil.contains(location.project.directory, current.location.directory)
      )
        return yield* Effect.fail(new Error("The checkpoint session belongs to another project or worktree."))
      return current
    })
    const guarded = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      locks.withLock(prefix)(migrate().pipe(Effect.andThen(effect)))
    yield* ctx.rpc
      .register(BoltCheckpoint.Definition, {
        save: (input, context) =>
          guarded(
            Effect.gen(function* () {
              if (input.sessionID) yield* session(input.sessionID)
              const tree = yield* snapshot.capture({ scope: "project" })
              if (!tree) return yield* Effect.fail(new Error("Checkpoints require an enabled Git snapshot service."))
              const last = input.sessionID
                ? (yield* sessions.messages({
                    sessionID: Session.ID.make(input.sessionID),
                    order: "desc",
                    limit: 1,
                  }))[0]
                : undefined
              const info: BoltCheckpoint.Info = {
                name: input.name,
                time: yield* Clock.currentTimeMillis,
                snapshot: tree,
                ...(input.sessionID ? { sessionID: input.sessionID } : {}),
                ...(last ? { messageID: last.id } : {}),
              }
              yield* kv.set(prefix + input.name, { ...info })
              return info
            }),
          ).pipe(
            Effect.mapError((error) =>
              context.error("failed", error instanceof Error ? error.message : String(error), {}),
            ),
          ),
        list: (_, context) =>
          guarded(
            Effect.gen(function* () {
              const found: BoltCheckpoint.Info[] = []
              let after: string | undefined
              do {
                const page = yield* kv.scan({ prefix, after, limit: 1000 })
                for (const item of page.entries) {
                  if (item.key === `${prefix}@imported`) continue
                  const info = Option.getOrUndefined(decode(item.value))
                  if (!info) return yield* Effect.fail(new Error(`Invalid stored checkpoint: ${item.key}`))
                  found.push(info)
                }
                after = page.next
              } while (after)
              return found.toSorted((a, b) => b.time - a.time)
            }),
          ).pipe(
            Effect.mapError((error) =>
              context.error("failed", error instanceof Error ? error.message : String(error), {}),
            ),
          ),
        rewind: (input, context) =>
          guarded(
            Effect.gen(function* () {
              const info = yield* get(input.name)
              const active = yield* sessions.active
              for (const id of active) {
                const running = yield* sessions.get(id)
                if (running.projectID === location.project.id)
                  return yield* Effect.fail(
                    new Error("Wait for active project sessions before rewinding a checkpoint."),
                  )
              }
              // Resolve both trees before changing conversation state; missing legacy
              // objects must fail without hiding newer V2 messages.
              const current = yield* snapshot.capture({ scope: "project" })
              if (!current) return yield* Effect.fail(new Error("Checkpoints require an enabled Git snapshot service."))
              const tree = Snapshot.ID.make(info.snapshot)
              yield* snapshot.files({ from: tree, to: current })
              if (info.sessionID) {
                yield* session(info.sessionID)
                if (
                  info.messageID &&
                  !(yield* sessions.message({
                    sessionID: Session.ID.make(info.sessionID),
                    messageID: SessionMessage.ID.make(info.messageID),
                  }))
                )
                  return yield* Effect.fail(
                    new Error("The checkpoint's conversation marker is no longer available; no files were restored."),
                  )
                const next = (yield* sessions.messages({
                  sessionID: Session.ID.make(info.sessionID),
                  order: "asc",
                  limit: 1,
                  ...(info.messageID
                    ? { cursor: { id: SessionMessage.ID.make(info.messageID), direction: "next" as const } }
                    : {}),
                }))[0]
                if (next)
                  yield* sessions.revert.stage({
                    sessionID: Session.ID.make(info.sessionID),
                    messageID: next.id,
                    files: false,
                  })
              }
              const staged = yield* snapshot.capture({ scope: "project" })
              if (!staged) return yield* Effect.fail(new Error("Unable to capture the repository before restoring."))
              const files = yield* snapshot.files({ from: tree, to: staged })
              yield* snapshot.restore({ files: new Map(files.map((file) => [file, tree])) })
              return info
            }),
          ).pipe(
            Effect.mapError((error) =>
              context.error("failed", error instanceof Error ? error.message : String(error), {}),
            ),
          ),
        remove: (input, context) =>
          guarded(
            Effect.gen(function* () {
              yield* get(input.name)
              yield* kv.remove(prefix + input.name)
              return { removed: input.name }
            }),
          ).pipe(
            Effect.mapError((error) =>
              context.error("failed", error instanceof Error ? error.message : String(error), {}),
            ),
          ),
      })
      .pipe(Effect.orDie)
  }),
})
