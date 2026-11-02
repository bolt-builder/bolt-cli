export * as WorkspaceEdit from "./workspace-edit.js"
import { Schema } from "effect"
import { LSP } from "../lsp.js"

export const TextEdit = Schema.Struct({ range: LSP.Range, newText: Schema.String })
export type TextEdit = typeof TextEdit.Type
export const Edit = Schema.Struct({
  changes: Schema.optionalKey(Schema.Record(Schema.String, Schema.Array(TextEdit))),
  documentChanges: Schema.optionalKey(
    Schema.Array(
      Schema.Union([
        Schema.Struct({
          textDocument: Schema.Struct({
            uri: Schema.String,
            version: Schema.optionalKey(Schema.Union([Schema.Number, Schema.Null])),
          }),
          edits: Schema.Array(TextEdit),
        }),
        Schema.Struct({ kind: Schema.Literals(["create", "rename", "delete"]) }),
      ]),
    ),
  ),
})
export type Edit = typeof Edit.Type
export function offsetAt(content: string, position: typeof LSP.Position.Type) {
  const lines = content.split("\n")
  if (position.line >= lines.length) return content.length
  return (
    lines.slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0) +
    Math.min(position.character, lines[position.line].length)
  )
}
export function apply(content: string, edits: readonly TextEdit[]) {
  const ordered = edits
    .map((edit) => ({
      start: offsetAt(content, edit.range.start),
      end: offsetAt(content, edit.range.end),
      text: edit.newText,
    }))
    .toSorted((a, b) => b.start - a.start || b.end - a.end)
  let previous = content.length + 1
  for (const edit of ordered) {
    if (edit.start > edit.end || edit.end > previous)
      throw new Error("Language server returned overlapping or reversed rename edits")
    previous = edit.start
  }
  return ordered.reduce((result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end), content)
}
export function collect(edit: Edit) {
  const result = new Map<string, { edits: TextEdit[]; version?: number }>()
  for (const [uri, edits] of Object.entries(edit.changes ?? {}))
    if (edits.length) result.set(uri, { edits: [...edits] })
  for (const change of edit.documentChanges ?? []) {
    if (!("textDocument" in change) || !change.edits.length) continue
    const previous = result.get(change.textDocument.uri)
    const version = change.textDocument.version ?? undefined
    if (previous?.version !== undefined && version !== undefined && previous.version !== version)
      throw new Error("Language server returned conflicting document versions")
    result.set(change.textDocument.uri, {
      edits: [...(previous?.edits ?? []), ...change.edits],
      version: version ?? previous?.version,
    })
  }
  return result
}
