export * as MemorySaveTool from "./memory-save"

import { ToolFailure } from "@opencode-ai/llm"
import { MemoryControls } from "@opencode-ai/memory/controls"
import { MemoryService } from "@opencode-ai/memory/effect/service"
import { MemoryTool } from "@opencode-ai/memory/tool"
import { eq } from "drizzle-orm"
import { Effect, Layer, Schema } from "effect"
import { Database } from "../database/database"
import { makeLocationNode } from "../effect/app-node"
import { Location } from "../location"
import { PermissionV2 } from "../permission"
import { SessionTable } from "../session/sql"
import { ToolRegistry } from "./registry"
import { Tool } from "./tool"
import { Tools } from "./tools"

export const name = "memory_save"

export const Output = Schema.Struct({
  title: Schema.String,
  output: Schema.String,
  metadata: Schema.Struct({
    sources: Schema.Array(Schema.String),
    count: Schema.optional(Schema.Number),
    operationCount: Schema.optional(Schema.Number),
    added: Schema.optional(Schema.Number),
    removed: Schema.optional(Schema.Number),
    skippedCount: Schema.optional(Schema.Number),
    reason: Schema.optional(Schema.Literal("out_of_scope")),
  }),
})

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const location = yield* Location.Service
    const permission = yield* PermissionV2.Service
    const { db } = yield* Database.Service
    const memory = MemoryService.make()
    const ctx = { directory: location.directory, worktree: location.project.directory }

    yield* tools
      .register({
        [name]: Tool.make({
          description: MemoryTool.SaveDescription,
          input: MemoryTool.SaveParameters,
          output: Output,
          toModelOutput: ({ output }) => [{ type: "text", text: output.output }],
          execute: (input, context) =>
            Effect.gen(function* () {
              const row = yield* db
                .select({ metadata: SessionTable.metadata })
                .from(SessionTable)
                .where(eq(SessionTable.id, context.sessionID))
                .get()
                .pipe(Effect.orDie)
              if (!MemoryControls.contribute(row?.metadata))
                return {
                  title: "Bolt memory: off for this session",
                  output:
                    "Memory contribution is turned off for this session. Turn it back on with /memory contribute on.",
                  metadata: { sources: [] },
                }
              // The engine reports disabled memory as a regular tool result, so only an
              // enabled store prompts for approval.
              const enabled = yield* memory.prepare({ ctx }).pipe(
                Effect.flatMap((root) => memory.state({ root })),
                Effect.map((state) => state.enabled),
                Effect.catch(() => Effect.succeed(false)),
              )
              if (enabled) {
                yield* permission
                  .assert({
                    action: name,
                    resources: [input.action],
                    save: [],
                    metadata: input,
                    sessionID: context.sessionID,
                    agent: context.agent,
                    source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
                  })
                  .pipe(Effect.mapError(() => new ToolFailure({ message: `Memory ${input.action} was not approved` })))
              }
              return yield* MemoryTool.save({
                memory,
                params: input,
                sessionID: context.sessionID,
                messageID: context.assistantMessageID,
                ctx,
                ask: () => Effect.void,
              }).pipe(Effect.catchIf(MemoryTool.failure, (err) => Effect.succeed(MemoryTool.error("save", err))))
            }),
        }),
      })
      .pipe(Effect.orDie)
  }),
)

export const node = makeLocationNode({
  name: "tool/memory-save",
  layer,
  deps: [ToolRegistry.node, PermissionV2.node, Location.node, Database.node],
})
