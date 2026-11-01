export * as DiagnosticsTool from "./diagnostics.js"
import path from "node:path"
import { ToolFailure } from "@opencode/ai/effect"
import type { Context } from "@opencode/plugin/effect/plugin"
import { Effect, Schema } from "effect"
import { Environment } from "../../environment/index.js"
import { FileAccess } from "../../file-access.js"
import { Location } from "../../location.js"
import { LSP } from "../../lsp.js"
import { Permission } from "../../permission.js"
import DESCRIPTION from "./diagnostics.txt"

const severities = ["error", "warning", "info", "hint"] as const
export type Severity = (typeof severities)[number]

export function label(value: number | undefined): Severity {
  if (value === 2) return "warning"
  if (value === 3) return "info"
  if (value === 4) return "hint"
  return "error"
}

export function within(file: string, root: string) {
  if (file === root) return true
  const relative = path.relative(root, file)
  if (!relative) return true
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

export function filter(all: Record<string, LSP.Diagnostic[]>, options: { path?: string; severity?: Severity }) {
  const result: Record<string, LSP.Diagnostic[]> = {}
  for (const file of Object.keys(all).sort()) {
    if (options.path && !within(file, options.path)) continue
    const items = all[file]
      .filter((item) => !options.severity || label(item.severity) === options.severity)
      .toSorted((a, b) => a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character)
    if (items.length === 0) continue
    result[file] = items
  }
  return result
}

export function format(file: string, diagnostic: LSP.Diagnostic) {
  const line = diagnostic.range.start.line + 1
  const column = diagnostic.range.start.character + 1
  const source = diagnostic.source ? ` [${diagnostic.source}]` : ""
  return `${file}:${line}:${column} ${label(diagnostic.severity)} ${diagnostic.message}${source}`
}

export function render(diagnostics: Record<string, LSP.Diagnostic[]>) {
  const files = Object.keys(diagnostics)
  const total = files.reduce((sum, file) => sum + diagnostics[file].length, 0)
  if (total === 0) return "No diagnostics found."
  const lines = files.flatMap((file) => diagnostics[file].map((item) => format(file, item)))
  const summary = `${total} diagnostic${total === 1 ? "" : "s"} in ${files.length} file${files.length === 1 ? "" : "s"}:`
  return [summary, ...lines].join("\n")
}

export const Input = Schema.Struct({
  path: Schema.optionalKey(Schema.String),
  severity: Schema.optionalKey(Schema.Literals(severities)),
})
export const Plugin = {
  id: "bolt.tool.diagnostics",
  effect: Effect.fn("DiagnosticsTool.Plugin")(function* (ctx: Context) {
    const access = yield* FileAccess.Service
    const environment = yield* Environment.Service
    const location = yield* Location.Service
    const lsp = yield* LSP.Service
    const permission = yield* Permission.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name: "diagnostics",
          options: { codemode: false },
          description: DESCRIPTION,
          input: Input,
          output: Schema.Struct({ diagnostics: Schema.Record(Schema.String, Schema.Array(LSP.Diagnostic)) }),
          execute: (input, context) =>
            Effect.gen(function* () {
              const target = input.path ? yield* access.authorizeRead(input.path, context) : undefined
              yield* permission.assert({
                action: "lsp",
                resources: ["*"],
                save: ["*"],
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.messageID, id: context.id },
                metadata: {
                  operation: "diagnostics",
                  ...(target ? { path: target.absolute } : {}),
                  ...(input.severity ? { severity: input.severity } : {}),
                },
              })
              if (target && (yield* Environment.typeFollowing(environment.files, target.absolute)) === "file")
                yield* lsp.touchFile(target.absolute, "full")
              const scoped = filter(yield* lsp.diagnostics(), {
                path: target?.absolute ?? location.project.directory,
                severity: input.severity,
              })
              const diagnostics = Object.fromEntries(
                Object.entries(scoped).map(([file, items]) => [
                  path.relative(location.project.directory, file) || file,
                  items,
                ]),
              )
              return {
                output: { diagnostics },
                content: [{ type: "text" as const, text: render(diagnostics) }],
                metadata: {
                  files: Object.keys(diagnostics).length,
                  total: Object.values(diagnostics).reduce((sum, items) => sum + items.length, 0),
                },
              }
            }).pipe(Effect.mapError((error) => new ToolFailure({ message: "Unable to collect diagnostics", error }))),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
