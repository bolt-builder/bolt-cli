import path from "path"
import { Effect, Schema } from "effect"
import type { Session as SDKSession, Message, Part } from "@opencode-ai/sdk/v2"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import type { Session } from "@/session/session"
import type { InstanceContext } from "@/project/instance-context"

// Session bundles in the existing export/import format: the unit moved by
// `bolt export`/`bolt import` on disk and by `bolt push`/`bolt pull` through
// a remote bolt server.

export type Data = {
  info: SDKSession
  messages: Array<{ info: Message; parts: Part[] }>
}

const decodeMessageInfo = Schema.decodeUnknownSync(SessionV1.Info)
const decodePart = Schema.decodeUnknownSync(SessionV1.Part)

/** Structural guard for an untrusted bundle payload. */
export function valid(input: unknown): input is Data {
  if (!input || typeof input !== "object") return false
  const data = input as { info?: { id?: unknown }; messages?: unknown }
  if (!data.info || typeof data.info !== "object" || typeof data.info.id !== "string" || !data.info.id) return false
  if (!Array.isArray(data.messages)) return false
  return data.messages.every((message) => {
    if (!message || typeof message !== "object") return false
    const entry = message as { info?: { id?: unknown }; parts?: unknown }
    if (!entry.info || typeof entry.info !== "object" || typeof entry.info.id !== "string") return false
    return Array.isArray(entry.parts)
  })
}

/** Read a session and its messages as a bundle. Session lookup failures surface as defects (catchCause). */
export const dump = Effect.fn("SessionBundle.dump")(function* (sessionID: string) {
  const { Session } = yield* Effect.promise(() => import("@/session/session"))
  const { SessionID } = yield* Effect.promise(() => import("@/session/schema"))
  const svc = yield* Session.Service
  const info = yield* svc.get(SessionID.make(sessionID))
  const messages = yield* svc.messages({ sessionID: info.id })
  return { info, messages } as Data
})

/** Insert a bundle into the local database, rebinding it to the given instance. */
export const load = Effect.fn("SessionBundle.load")(function* (data: Data, ctx: InstanceContext) {
  const { Info, toRow } = yield* Effect.promise(() => import("@/session/session"))
  const { Database } = yield* Effect.promise(() => import("@opencode-ai/core/database/database"))
  const { SessionTable, MessageTable, PartTable } = yield* Effect.promise(() => import("@opencode-ai/core/session/sql"))
  const { db } = yield* Database.Service

  const info = Schema.decodeUnknownSync(Info)({
    ...data.info,
    projectID: ctx.project.id,
    directory: ctx.directory,
    path: path.relative(path.resolve(ctx.worktree), ctx.directory).replaceAll("\\", "/"),
  }) as Session.Info
  const row = toRow(info)
  yield* db
    .insert(SessionTable)
    .values(row)
    .onConflictDoUpdate({
      target: SessionTable.id,
      set: { project_id: row.project_id, directory: row.directory, path: row.path },
    })
    .run()
    .pipe(Effect.orDie)

  for (const msg of data.messages) {
    const msgInfo = decodeMessageInfo(msg.info) as SessionV1.Info
    const { id, sessionID: _, ...msgData } = msgInfo
    yield* db
      .insert(MessageTable)
      .values({
        id,
        session_id: row.id,
        time_created: msgInfo.time?.created ?? Date.now(),
        data: msgData as never,
      })
      .onConflictDoNothing()
      .run()
      .pipe(Effect.orDie)

    for (const part of msg.parts) {
      const partInfo = decodePart(part) as SessionV1.Part
      const { id: partId, sessionID: _s, messageID, ...partData } = partInfo
      yield* db
        .insert(PartTable)
        .values({
          id: partId,
          message_id: messageID,
          session_id: row.id,
          data: partData,
        })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
    }
  }

  return info.id
})

export * as SessionBundle from "./bundle"
