"use server"

import { Effect, Layer, Schema } from "effect"
import { SystemContext } from "../system-context/index"
import { SystemContextRegistry } from "../system-context/registry"
import { MemoryStore, MemoryEntrySchema, MAX_PROMPT_BYTES } from "./store"
import { makeLocationNode } from "../effect/app-node"

const key = SystemContext.Key.make("core/memory")

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const registry = yield* SystemContextRegistry.Service
    const memory = yield* MemoryStore.Service

    const source = (entries: ReadonlyArray<{ id: string; createdAt: string; category?: string; content: string }>) =>
      SystemContext.make({
        key,
        codec: Schema.toCodecJson(Schema.Array(MemoryEntrySchema)),
        load: Effect.succeed(entries),
        baseline: renderEntries,
        update: (_previous, current) => renderEntries(current),
      })

    yield* registry.register({
      key,
      load: memory.read().pipe(
        Effect.map((entries) => (entries.length === 0 ? SystemContext.empty : source(entries))),
        Effect.catch(() => Effect.succeed(SystemContext.empty)),
      ),
    })
  }),
)

export const node = makeLocationNode({
  name: "memory-context",
  layer,
  deps: [SystemContextRegistry.node, MemoryStore.node],
})

function renderEntries(entries: ReadonlyArray<{ id: string; createdAt: string; category?: string; content: string }>) {
  const parts: string[] = []
  let size = 0
  for (const entry of entries) {
    const line = `- [${entry.category ?? "memory"}] ${entry.content}`
    if (size + line.length + 1 > MAX_PROMPT_BYTES) {
      parts.push("... (truncated)")
      break
    }
    parts.push(line)
    size += line.length + 1
  }
  if (parts.length === 0) return ""
  return ["# Memory", ...parts].join("\n")
}
