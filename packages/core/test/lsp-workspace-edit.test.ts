import { describe, expect, test } from "bun:test"
import { WorkspaceEdit } from "@opencode/core/lsp/workspace-edit"
const range = (start: number, end: number) => ({
  start: { line: 0, character: start },
  end: { line: 0, character: end },
})
describe("V1 workspace text edits", () => {
  test("applies original UTF-16 offsets in reverse order and preserves CRLF", () => {
    expect(
      WorkspaceEdit.apply("🔥 symbol + symbol\r\nnext\r\n", [
        { range: range(3, 9), newText: "name" },
        { range: range(12, 18), newText: "name" },
      ]),
    ).toBe("🔥 name + name\r\nnext\r\n")
    expect(WorkspaceEdit.offsetAt("abc\ndef", { line: 0, character: 99 })).toBe(3)
    expect(WorkspaceEdit.offsetAt("abc\ndef", { line: 99, character: 99 })).toBe(7)
  })
  test("merges changes and versioned documentChanges and skips resource operations", () => {
    const edit = { range: range(0, 1), newText: "x" }
    expect([
      ...WorkspaceEdit.collect({
        changes: { "file:///a": [edit] },
        documentChanges: [{ textDocument: { uri: "file:///a", version: 2 }, edits: [edit] }, { kind: "rename" }],
      }),
    ]).toEqual([["file:///a", { edits: [edit, edit], version: 2 }]])
  })
  test("rejects overlap, reversed edits and conflicting versions before writing", () => {
    expect(() =>
      WorkspaceEdit.apply("abc", [
        { range: range(0, 2), newText: "x" },
        { range: range(1, 3), newText: "y" },
      ]),
    ).toThrow("overlapping")
    expect(() => WorkspaceEdit.apply("abc", [{ range: range(2, 1), newText: "x" }])).toThrow("reversed")
    expect(() =>
      WorkspaceEdit.collect({
        documentChanges: [1, 2].map((version) => ({
          textDocument: { uri: "file:///a", version },
          edits: [{ range: range(0, 1), newText: "x" }],
        })),
      }),
    ).toThrow("conflicting")
  })
})
