"use server"

import { ToolFailure } from "@opencode-ai/llm"
import { Effect, Layer, Schema } from "effect"
import { makeLocationNode } from "../effect/app-node"
import { PermissionV2 } from "../permission"
import { Tools } from "../tool/tools"
import { ToolRegistry } from "../tool/registry"
import { Tool } from "../tool/tool"
import { MemoryStore, MemoryEntrySchema } from "./store"

export const name = "memory"

export const Input = Schema.Struct({
  action: Schema.Literals(["add", "list", "delete", "search"]).annotate({ description: "The memory operation to perform" }),
  category: Schema.optional(Schema.String).annotate({ description: "Category filter for list or search" }),
  content: Schema.optional(Schema.String).annotate({ description: "Content to remember (for add)" }),
  id: Schema.optional(Schema.String).annotate({ description: "Entry ID (for delete)" }),
  query: Schema.optional(Schema.String).annotate({ description: "Search query (for search)" }),
})

export const Output = Schema.Struct({
  action: Schema.String,
  entries: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      createdAt: Schema.String,
      category: Schema.optional(Schema.String),
      content: Schema.String,
    }),
  ),
})

export const toModelOutput = (input: { input: typeof Input.Type; output: typeof Output.Type }) => {
  const entries = input.output.entries
  const text = entries.length === 0 ? "No memory entries found." : entries.map((e) => `[${e.category ?? "memory"}] ${e.content}`).join("\n")
  return [{ type: "text" as const, text }]
}

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const memory = yield* MemoryStore.Service
    const permission = yield* PermissionV2.Service

    yield* tools
      .register({
        [name]: Tool.make({
          description:
            "Manage persistent global memory across sessions. Use add to remember user preferences and facts, list to review memory, delete to remove outdated entries, and search to find relevant memories.",
          input: Input,
          output: Output,
          toModelOutput,
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* permission.assert({
                action: name,
                resources: ["*"],
                save: ["*"],
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
              })

              switch (input.action) {
                case "add": {
                  if (!input.content) return yield* new ToolFailure({ message: "content is required for add" })
                  const entry = yield* memory.append({ category: input.category, content: input.content })
                  return { action: "add" as const, entries: [entry] }
                }
                case "list": {
                  const entries = yield* memory.read()
                  const filtered = input.category
                    ? entries.filter((e) => e.category === input.category)
                    : entries
                  return { action: "list" as const, entries: filtered }
                }
                case "delete": {
                  if (!input.id) return yield* new ToolFailure({ message: "id is required for delete" })
                  yield* memory.remove(input.id)
                  return { action: "delete" as const, entries: [] }
                }
                case "search": {
                  if (!input.query) return yield* new ToolFailure({ message: "query is required for search" })
                  const entries = yield* memory.read()
                  const query = input.query.toLowerCase()
                  const matched = entries
                    .filter((e) => {
                      if (input.category && e.category !== input.category) return false
                      return e.content.toLowerCase().includes(query) || e.category?.toLowerCase().includes(query)
                    })
                    .slice(0, 10)
                  return { action: "search" as const, entries: matched }
                }
              }
            }).pipe(Effect.mapError(() => new ToolFailure({ message: `Unable to perform memory ${input.action}` }))),
        }),
      })
      .pipe(Effect.orDie)
  }),
)

export const node = makeLocationNode({
  name: "tool/memory",
  layer,
  deps: [ToolRegistry.node, PermissionV2.node, MemoryStore.node],
})
