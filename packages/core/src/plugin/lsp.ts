export * as LspPlugin from "./lsp.js"
import { define } from "@opencode/plugin/effect/plugin"
import { Effect, Option, Schema } from "effect"
import path from "node:path"
import { FileAccess } from "../file-access.js"
import { Location } from "../location.js"
import { LSP } from "../lsp.js"
import { Permission } from "../permission.js"
import { DiagnosticsTool } from "../tool/plugin/diagnostics.js"

const Written = Schema.Struct({
  target: Schema.optionalKey(Schema.String),
  files: Schema.optionalKey(
    Schema.Array(Schema.Struct({ file: Schema.String, status: Schema.optionalKey(Schema.String) })),
  ),
  applied: Schema.optionalKey(Schema.Array(Schema.Struct({ target: Schema.String, type: Schema.String }))),
})
export const Plugin = define({
  id: "bolt.lsp",
  effect: Effect.fn(function* (ctx) {
    const lsp = yield* LSP.Service
    const permission = yield* Permission.Service
    const location = yield* Location.Service
    yield* ctx.tool.hook("execute.after", (event) => {
      if (event.status !== "completed" || !["edit", "write", "multiedit", "patch", "lsp_rename"].includes(event.tool))
        return Effect.void
      const parsed = Schema.decodeUnknownOption(Written)(event.result.output)
      if (Option.isNone(parsed)) return Effect.void
      const written = parsed.value
      const targets =
        written.applied?.map((entry) => ({ file: entry.target, deleted: entry.type === "delete" })) ??
        (written.target
          ? [{ file: written.target, deleted: false }]
          : (written.files?.map((entry) => ({ file: entry.file, deleted: entry.status === "deleted" })) ?? []))
      const content =
        typeof event.result.content === "string"
          ? [{ type: "text" as const, text: event.result.content }]
          : [...(event.result.content ?? [])]
      return Effect.gen(function* () {
        // Editing already authorized the file. An explicit LSP denial still prevents
        // starting a server; it does not undo a successfully completed mutation.
        yield* permission.assertNotDenied({
          action: "lsp",
          resources: ["*"],
          save: ["*"],
          sessionID: event.sessionID,
          agent: event.agent,
          source: { type: "tool", messageID: event.messageID, id: event.id },
        })
        for (const target of new Map(targets.map((entry) => [entry.file, entry])).values()) {
          const file = FileAccess.resolvePath(location.directory, target.file)
          if (target.deleted) {
            yield* lsp.closeFile(file)
            continue
          }
          const result = yield* lsp.touchFile(file, "full").pipe(Effect.result)
          if (result._tag === "Failure") {
            content.push({
              type: "text",
              text: `File saved. Language-server diagnostics unavailable: ${String(result.failure).slice(0, 2000)}`,
            })
            continue
          }
          const diagnostics =
            (yield* lsp.diagnostics())[file]?.filter((item) => DiagnosticsTool.label(item.severity) === "error") ?? []
          if (diagnostics.length)
            content.push({
              type: "text",
              text:
                "Language-server errors after edit:\n" +
                diagnostics
                  .slice(0, 20)
                  .map((item) => DiagnosticsTool.format(path.relative(location.project.directory, file), item))
                  .join("\n") +
                (diagnostics.length > 20
                  ? `\n${diagnostics.length - 20} more errors; use diagnostics for the complete report.`
                  : ""),
            })
        }
        event.result = { ...event.result, content }
      }).pipe(Effect.catch(() => Effect.void))
    })
  }),
})
