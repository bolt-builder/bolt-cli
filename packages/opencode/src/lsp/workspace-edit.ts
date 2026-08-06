import type { TextEdit, WorkspaceEdit } from "vscode-languageserver-types"

export type Position = { line: number; character: number }

// Offset of an LSP position inside `content`. Positions past the end of a
// line clamp to that line's end; lines past the end of the file clamp to the
// end of the content, matching how servers treat out-of-range positions.
export function offsetAt(content: string, position: Position) {
  const lines = content.split("\n")
  if (position.line >= lines.length) return content.length
  const start = lines.slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0)
  return start + Math.min(position.character, lines[position.line].length)
}

// Apply non-overlapping LSP text edits to a document. Offsets are resolved
// against the original content, then edits are applied back-to-front so
// earlier offsets stay valid.
export function apply(content: string, edits: TextEdit[]) {
  const ordered = edits
    .map((edit) => ({
      start: offsetAt(content, edit.range.start),
      end: offsetAt(content, edit.range.end),
      text: edit.newText,
    }))
    .toSorted((a, b) => b.start - a.start || b.end - a.end)
  return ordered.reduce((acc, edit) => acc.slice(0, edit.start) + edit.text + acc.slice(edit.end), content)
}

// Flatten a WorkspaceEdit into per-URI text edits. Merges the legacy
// `changes` map with `documentChanges` entries; resource operations
// (create/rename/delete file) carry no text edits and are skipped.
export function collect(edit: WorkspaceEdit) {
  const result: Record<string, TextEdit[]> = {}
  const add = (uri: string, edits: TextEdit[]) => {
    if (edits.length === 0) return
    const existing = result[uri] ?? []
    result[uri] = existing.concat(edits)
  }
  const changes = edit.changes ?? {}
  for (const uri of Object.keys(changes)) add(uri, changes[uri])
  for (const change of edit.documentChanges ?? []) {
    if (!("textDocument" in change)) continue
    add(change.textDocument.uri, change.edits.filter((item) => typeof item.newText === "string"))
  }
  return result
}

export * as WorkspaceEdit from "./workspace-edit"
