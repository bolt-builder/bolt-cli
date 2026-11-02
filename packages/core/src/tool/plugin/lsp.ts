export * as LspTool from "./lsp.js"
import { ToolFailure } from "@opencode/ai/effect"
import type { Context } from "@opencode/plugin/effect/plugin"
import { Effect, Schema } from "effect"
import { Environment } from "../../environment/index.js"
import { FileAccess } from "../../file-access.js"
import { LSP } from "../../lsp.js"
import { Permission } from "../../permission.js"
import DESCRIPTION from "./lsp.txt"

export const Input = Schema.Struct({
  operation: Schema.Literals(LSP.operations),
  filePath: Schema.String,
  line: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  character: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  query: Schema.optionalKey(Schema.String),
})
export const Plugin = {
  id: "bolt.tool.lsp",
  effect: Effect.fn("LspTool.Plugin")(function* (ctx: Context) {
    const access = yield* FileAccess.Service
    const environment = yield* Environment.Service
    const lsp = yield* LSP.Service
    const permission = yield* Permission.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name: "lsp",
          options: { codemode: false },
          description: DESCRIPTION,
          input: Input,
          output: Schema.Struct({ results: Schema.Array(Schema.Unknown) }),
          execute: (input, context) =>
            Effect.gen(function* () {
              const target = yield* access.authorizeRead(input.filePath, context)
              if ((yield* Environment.typeFollowing(environment.files, target.absolute)) !== "file")
                return yield* Effect.fail(new Error(`File not found: ${input.filePath}`))
              yield* permission.assert({
                action: "lsp",
                resources: ["*"],
                save: ["*"],
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.messageID, id: context.id },
                metadata: {
                  operation: input.operation,
                  filePath: target.absolute,
                  line: input.line,
                  character: input.character,
                },
              })
              if (!(yield* lsp.touchFile(target.absolute)))
                return yield* Effect.fail(
                  new Error(
                    `No language server available for ${input.filePath}. Install a supported server or configure lsp in bolt.json.`,
                  ),
                )
              const results = yield* lsp.query(
                target.absolute,
                input.operation,
                { line: input.line - 1, character: input.character - 1 },
                input.query,
              )
              return {
                output: { results },
                content: [
                  {
                    type: "text" as const,
                    text: results.length ? JSON.stringify(results, null, 2) : "No results found.",
                  },
                ],
                metadata: { operation: input.operation, file: target.resource },
              }
            }).pipe(Effect.mapError((error) => new ToolFailure({ message: "LSP request failed", error }))),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
