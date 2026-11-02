export * as LspRenameTool from "./lsp-rename.js"
import { ToolFailure } from "@opencode/ai/effect"
import type { Context } from "@opencode/plugin/effect/plugin"
import { Bom } from "@opencode/util/bom"
import { Effect, Schema } from "effect"
import { fileURLToPath } from "node:url"
import { Environment } from "../../environment/index.js"
import { FileAccess } from "../../file-access.js"
import { FileMutation } from "../../file-mutation.js"
import { Location } from "../../location.js"
import { LSP } from "../../lsp.js"
import { WorkspaceEdit } from "../../lsp/workspace-edit.js"
import { Permission } from "../../permission.js"
import { DiagnosticsTool } from "./diagnostics.js"
import { LspReferencesTool } from "./lsp-references.js"
import { fileDiff } from "./file-diff.js"
import DESCRIPTION from "./lsp-rename.txt"

export const Input = Schema.Struct({
  ...LspReferencesTool.Input.fields,
  newName: Schema.String.check(Schema.isMinLength(1)),
})
export const Plugin = {
  id: "bolt.tool.lsp-rename",
  effect: Effect.fn("LspRenameTool.Plugin")(function* (ctx: Context) {
    const access = yield* FileAccess.Service
    const environment = yield* Environment.Service
    const location = yield* Location.Service
    const lsp = yield* LSP.Service
    const mutations = yield* FileMutation.Service
    const permission = yield* Permission.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name: "lsp_rename",
          options: { codemode: false, permission: "edit" },
          description: DESCRIPTION,
          input: Input,
          output: Schema.Struct({
            files: Schema.Array(Schema.Struct({ file: Schema.String, edits: Schema.Number })),
            edits: Schema.Number,
            ignoredResourceOperations: Schema.Number,
            skippedOutsideProject: Schema.Array(Schema.String),
          }),
          execute: (input, context) =>
            Effect.gen(function* () {
              const source = { type: "tool" as const, messageID: context.messageID, id: context.id }
              const target = yield* access.authorizeRead(input.filePath, context)
              yield* permission.assertNotDenied({
                action: "edit",
                resources: ["*"],
                save: ["*"],
                sessionID: context.sessionID,
                agent: context.agent,
                source,
              })
              yield* permission.assert({
                action: "lsp",
                resources: ["*"],
                save: ["*"],
                sessionID: context.sessionID,
                agent: context.agent,
                source,
                metadata: { operation: "rename", filePath: target.absolute, newName: input.newName },
              })
              if (!(yield* lsp.touchFile(target.absolute)))
                return yield* Effect.fail(new Error("No LSP server available for this file type."))
              const responses = yield* lsp.rename(
                target.absolute,
                { line: input.line - 1, character: input.character - 1 },
                input.newName,
              )
              let documents: Record<string, { text: string; version: number }> = {}
              let selected: WorkspaceEdit.Edit | undefined
              for (const response of responses) {
                if (response.edit === null) continue
                const edit = yield* Schema.decodeUnknownEffect(WorkspaceEdit.Edit)(response.edit)
                if (WorkspaceEdit.collect(edit).size) {
                  documents = response.documents
                  selected = edit
                  break
                }
              }
              if (!selected)
                return {
                  output: { files: [], edits: 0, ignoredResourceOperations: 0, skippedOutsideProject: [] },
                  content:
                    "The language server returned no rename edits. Check the position points at a renameable symbol.",
                }
              const changes = WorkspaceEdit.collect(selected)
              const ignoredResourceOperations =
                selected.documentChanges?.filter((change) => "kind" in change).length ?? 0
              const skippedOutsideProject: string[] = []
              const suggested = yield* Effect.forEach([...changes], ([uri, change]) =>
                Effect.gen(function* () {
                  const file = yield* Effect.try(() => fileURLToPath(uri))
                  if (!DiagnosticsTool.within(file, location.project.directory)) {
                    skippedOutsideProject.push(file)
                    return undefined
                  }
                  const target = yield* access.authorizeRead(file, context)
                  return { uri, target, change }
                }),
              )
              const targets = suggested.filter((entry) => entry !== undefined)
              if (!targets.length)
                return {
                  output: { files: [], edits: 0, ignoredResourceOperations, skippedOutsideProject },
                  content: "The rename produced no applicable edits inside the project.",
                }
              return yield* Effect.gen(function* () {
                const prepared = yield* Effect.forEach(targets, (entry) =>
                  Effect.gen(function* () {
                    const original = yield* FileMutation.readText(environment.files, entry.target.absolute)
                    const snapshot = documents[entry.uri]
                    if (
                      snapshot &&
                      (snapshot.text !== original.text ||
                        (entry.change.version !== undefined && snapshot.version !== entry.change.version))
                    )
                      return yield* Effect.fail(
                        new Error(
                          `File changed while preparing rename: ${entry.target.resource}. Retry after refreshing the file.`,
                        ),
                      )
                    if (entry.change.version !== undefined && !snapshot)
                      return yield* Effect.fail(
                        new Error(`Cannot verify rename document version: ${entry.target.resource}`),
                      )
                    const content = yield* Effect.try(() => WorkspaceEdit.apply(original.text, entry.change.edits))
                    return {
                      ...entry,
                      original,
                      content,
                      preview: fileDiff(entry.target.resource, original.text, content),
                    }
                  }),
                )
                yield* permission.assert({
                  action: "edit",
                  resources: prepared.map((entry) => entry.target.resource),
                  save: ["*"],
                  sessionID: context.sessionID,
                  agent: context.agent,
                  source,
                  metadata: {
                    operation: "rename",
                    newName: input.newName,
                    files: prepared.map((entry) => entry.preview),
                  },
                })
                // Recheck the bytes after approval: the user can edit files while the prompt is open.
                for (const entry of prepared) {
                  const current = yield* FileMutation.readText(environment.files, entry.target.absolute)
                  if (current.text !== entry.original.text || current.bom !== entry.original.bom)
                    return yield* Effect.fail(
                      new Error(`File changed while awaiting rename approval: ${entry.target.resource}`),
                    )
                }
                const written: typeof prepared = []
                yield* Effect.gen(function* () {
                  for (const entry of prepared) {
                    yield* mutations.write({
                      target: entry.target,
                      content: Bom.join(entry.content, entry.original.bom),
                    })
                    written.push(entry)
                  }
                }).pipe(
                  Effect.catchCause((cause) =>
                    Effect.gen(function* () {
                      const rollback = yield* Effect.forEach(written.toReversed(), (entry) =>
                        mutations
                          .write({ target: entry.target, content: Bom.join(entry.original.text, entry.original.bom) })
                          .pipe(
                            Effect.result,
                            Effect.map((result) => ({ result, file: entry.target.resource })),
                          ),
                      )
                      const failed = rollback.filter((entry) => entry.result._tag === "Failure")
                      if (failed.length)
                        return yield* Effect.fail(
                          new Error(
                            `Rename failed and these files could not be restored: ${failed.map((entry) => entry.file).join(", ")}`,
                          ),
                        )
                      return yield* Effect.failCause(cause)
                    }),
                  ),
                  Effect.uninterruptible,
                )
                const files = prepared.map((entry) => ({
                  file: entry.target.resource,
                  edits: entry.change.edits.length,
                }))
                const edits = files.reduce((sum, entry) => sum + entry.edits, 0)
                return {
                  output: { files, edits, ignoredResourceOperations, skippedOutsideProject },
                  content: [
                    `Renamed to ${input.newName} in ${files.length} file${files.length === 1 ? "" : "s"} (${edits} edit${edits === 1 ? "" : "s"}):`,
                    ...files
                      .toSorted((a, b) => a.file.localeCompare(b.file))
                      .map((entry) => `${entry.file} (${entry.edits} edit${entry.edits === 1 ? "" : "s"})`),
                    ...(skippedOutsideProject.length
                      ? [`Skipped edits outside the project: ${skippedOutsideProject.join(", ")}`]
                      : []),
                    ...(ignoredResourceOperations
                      ? [
                          `${ignoredResourceOperations} file resource operations were not applied; move/create/delete those files separately.`,
                        ]
                      : []),
                  ].join("\n"),
                  metadata: { files: prepared.map((entry) => entry.preview), edits },
                }
              }).pipe(mutations.withLock(targets.map((entry) => entry.target.absolute)))
            }).pipe(Effect.mapError((error) => new ToolFailure({ message: "Unable to rename symbol", error }))),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
