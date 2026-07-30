export * as MemoryStore from "./store"

import crypto from "crypto"
import { Context, Effect, Layer, Schema } from "effect"
import { FSUtil } from "../fs-util"
import { Global } from "../global"
import { makeLocationNode } from "../effect/app-node"

export const MEMORY_PATH = Global.Path.config + "/memory.md"
export const MAX_PROMPT_BYTES = 4 * 1024

export const MemoryEntrySchema = Schema.Struct({
  id: Schema.String,
  createdAt: Schema.String,
  category: Schema.optional(Schema.String),
  content: Schema.String,
})

export type MemoryEntry = Schema.Schema.Type<typeof MemoryEntrySchema>

export class Service extends Context.Service<Service, Interface>()("@opencode/global/memory-store") {}

export interface Interface {
  readonly read: () => Effect.Effect<ReadonlyArray<MemoryEntry>, FSUtil.Error, never>
  readonly append: (entry: { category?: string; content: string }) => Effect.Effect<MemoryEntry, FSUtil.Error, never>
  readonly remove: (id: string) => Effect.Effect<void, FSUtil.Error, never>
}

const escapeMeta = (value: string) => JSON.stringify(value).slice(1, -1)
const normalize = (value: string) => value.replace(/\r?\n/g, "\n").trim()

const renderEntry = (entry: MemoryEntry) =>
  `<!-- entry {"id":"${escapeMeta(entry.id)}","createdAt":"${escapeMeta(entry.createdAt)}","category":"${escapeMeta(entry.category ?? "")}"} -->\n${entry.content}\n<!-- /entry -->`

const parseEntries = Effect.fn("Memory.parseEntries")(function* (text: string) {
  const seen = new Map<string, MemoryEntry>()
  for (const match of text.matchAll(/<!--\s*entry\s+\{([^}]*)\}\s*-->([\s\S]*?)<!--\s*\/entry\s*-->/g)) {
    let decoded: Record<string, unknown> = {}
    try {
      decoded = JSON.parse(`{${match[1]}}`) as Record<string, unknown>
    } catch {
      continue
    }
    const id = typeof decoded.id === "string" ? decoded.id : undefined
    const createdAt = typeof decoded.createdAt === "string" ? decoded.createdAt : undefined
    if (!id || !createdAt) continue
    const category = typeof decoded.category === "string" && decoded.category.length > 0 ? decoded.category : undefined
    const content = normalize(match[2])
    if (seen.has(id)) continue
    seen.set(id, { id, createdAt, category, content } as MemoryEntry)
  }
  return Object.freeze(Array.from(seen.values()))
})

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service

    const writeAtomic = Effect.fn("Memory.writeAtomic")(function* (filePath: string, content: string) {
      const temp = filePath + ".tmp." + process.pid + "." + Date.now()
      yield* fs.writeWithDirs(temp, content + "\n")
      yield* fs.rename(temp, filePath)
    })

    const read = Effect.fn("MemoryStore.read")(function* () {
      const raw = yield* fs.readFileStringSafe(MEMORY_PATH).pipe(Effect.catch(() => Effect.succeed(undefined)))
      const trimmed = (raw ?? "").trim()
      if (trimmed.length === 0) return [] as ReadonlyArray<MemoryEntry>
      return yield* parseEntries(trimmed).pipe(
        Effect.catch((error) =>
          Effect.gen(function* () {
            yield* Effect.logWarning(`Memory parse warning: ${String(error)}`)
            return [] as ReadonlyArray<MemoryEntry>
          }),
        ),
      )
    })

    const append = Effect.fn("MemoryStore.append")(function* (input: { category?: string; content: string }) {
      const content = normalize(input.content)
      const entry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        category: input.category,
        content,
      }
      const raw = yield* fs.readFileStringSafe(MEMORY_PATH).pipe(Effect.catch(() => Effect.succeed(undefined)))
      const existing = (raw ?? "").trim()
      const block = renderEntry(entry)
      yield* writeAtomic(MEMORY_PATH, existing ? existing + "\n\n" + block : block)
      return entry
    })

    const remove = Effect.fn("MemoryStore.delete")(function* (id: string) {
      const raw = yield* fs.readFileStringSafe(MEMORY_PATH).pipe(Effect.catch(() => Effect.succeed(undefined)))
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const pattern = new RegExp(`<!--\\s*entry\\s+\\{[^}]*"id":"${escaped}"[^}]*\\}\\s*-->[\\s\\S]*?<!--\\s*\\/entry\\s*-->`, "g")
      const next = (raw ?? "").replace(pattern, "").replace(/\n{3,}/g, "\n\n").trim()
      if (next !== (raw ?? "").trim()) {
        yield* writeAtomic(MEMORY_PATH, next ? next + "\n" : "")
      }
    })

    return Service.of({ read, append, remove })
  }),
)

export const node = makeLocationNode({
  name: "memory-store",
  layer,
  deps: [FSUtil.node, Global.node],
})
