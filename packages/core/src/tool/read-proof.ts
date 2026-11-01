export * as ReadProof from "./read-proof.js"

import path from "node:path"
import { Effect } from "effect"
import { Hash } from "@opencode/util/hash"
import type { KV } from "../kv.js"
import type { Session } from "../session.js"
import { FileAccess } from "../file-access.js"

const key = (sessionID: string, absolute: string) => `bolt.read.v1/${sessionID}/${Hash.fast(absolute)}`

export const note = (kv: Pick<KV.Interface, "get" | "set">, sessionID: string, absolute: string) =>
  kv.set(key(sessionID, absolute), absolute)

export const has = Effect.fn("ReadProof.has")(function* (
  kv: Pick<KV.Interface, "get" | "set">,
  sessions: Pick<Session.Interface, "context">,
  sessionID: Session.ID,
  directory: string,
  absolute: string,
) {
  if ((yield* kv.get(key(sessionID, absolute))) === absolute) return true
  // Imported sessions retain successful reads with explicit paths in durable history.
  // Relative paths from an older location cannot prove that the current file was read.
  const messages = yield* sessions.context(sessionID)
  const found = messages.some(
    (message) =>
      message.type === "assistant" &&
      message.content.some((part) => {
        if (part.type !== "tool" || part.name !== "read" || part.state.status !== "completed") return false
        const input = part.state.input.path ?? part.state.input.filePath
        return (
          typeof input === "string" && path.isAbsolute(input) && FileAccess.resolvePath(directory, input) === absolute
        )
      }),
  )
  if (found) yield* note(kv, sessionID, absolute)
  return found
})
