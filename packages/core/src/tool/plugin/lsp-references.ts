export * as LspReferencesTool from "./lsp-references.js"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ToolFailure } from "@opencode/ai/effect"
import type { Context } from "@opencode/plugin/effect/plugin"
import { Effect, Schema } from "effect"
import { Environment } from "../../environment/index.js"
import { FileAccess } from "../../file-access.js"
import { Location } from "../../location.js"
import { LSP } from "../../lsp.js"
import { Permission } from "../../permission.js"
import DESCRIPTION from "./lsp-references.txt"

type Reference = { uri: string; range: { start: { line: number; character: number } } }

export function render(locations: readonly Reference[], root: string) {
  return locations
    .map((item) => ({
      file: path.relative(root, fileURLToPath(item.uri)) || item.uri,
      line: item.range.start.line + 1,
      column: item.range.start.character + 1,
    }))
    .toSorted((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column)
    .map((item) => `${item.file}:${item.line}:${item.column}`)
}

export const Input = Schema.Struct({
  filePath: Schema.String,
  line: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  character: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
})
const Reference = Schema.Struct({ uri: Schema.String, range: LSP.Range })
export const Plugin = {
  id: "bolt.tool.lsp-references",
  effect: Effect.fn("LspReferencesTool.Plugin")(function* (ctx: Context) {
    const access = yield* FileAccess.Service
    const environment = yield* Environment.Service
    const location = yield* Location.Service
    const lsp = yield* LSP.Service
    const permission = yield* Permission.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name: "lsp_references",
          options: { codemode: false },
          description: DESCRIPTION,
          input: Input,
          output: Schema.Struct({ references: Schema.Array(Reference) }),
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
                  operation: "references",
                  filePath: target.absolute,
                  line: input.line,
                  character: input.character,
                },
              })
              if (!(yield* lsp.touchFile(target.absolute)))
                return yield* Effect.fail(new Error("No LSP server available for this file type."))
              const references = yield* lsp
                .query(target.absolute, "findReferences", { line: input.line - 1, character: input.character - 1 })
                .pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Reference))))
              const lines = render(references, location.project.directory)
              return {
                output: { references },
                content: [
                  {
                    type: "text" as const,
                    text: lines.length
                      ? [`${lines.length} reference${lines.length === 1 ? "" : "s"}:`, ...lines].join("\n")
                      : "No references found.",
                  },
                ],
                metadata: { count: lines.length },
              }
            }).pipe(Effect.mapError((error) => new ToolFailure({ message: "Unable to find references", error }))),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
