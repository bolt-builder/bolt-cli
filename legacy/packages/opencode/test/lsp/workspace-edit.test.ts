import { test, expect } from "bun:test"
import { WorkspaceEdit } from "@/lsp/workspace-edit"

function edit(
  start: [number, number],
  end: [number, number],
  text: string,
): {
  range: { start: { line: number; character: number }; end: { line: number; character: number } }
  newText: string
} {
  return {
    range: {
      start: { line: start[0], character: start[1] },
      end: { line: end[0], character: end[1] },
    },
    newText: text,
  }
}

test("offsetAt resolves line and character to an offset", () => {
  const content = "abc\ndef\nghi"
  expect(WorkspaceEdit.offsetAt(content, { line: 0, character: 0 })).toBe(0)
  expect(WorkspaceEdit.offsetAt(content, { line: 0, character: 2 })).toBe(2)
  expect(WorkspaceEdit.offsetAt(content, { line: 1, character: 0 })).toBe(4)
  expect(WorkspaceEdit.offsetAt(content, { line: 2, character: 3 })).toBe(11)
})

test("offsetAt clamps past-the-end positions", () => {
  const content = "abc\ndef"
  expect(WorkspaceEdit.offsetAt(content, { line: 0, character: 99 })).toBe(3)
  expect(WorkspaceEdit.offsetAt(content, { line: 9, character: 0 })).toBe(7)
})

test("apply replaces a single range", () => {
  const content = "const old = 1\nreturn old\n"
  const result = WorkspaceEdit.apply(content, [edit([0, 6], [0, 9], "fresh")])
  expect(result).toBe("const fresh = 1\nreturn old\n")
})

test("apply handles multiple edits on one line without offset drift", () => {
  const content = "old(old, old)"
  const edits = [edit([0, 0], [0, 3], "fresh"), edit([0, 4], [0, 7], "fresh"), edit([0, 9], [0, 12], "fresh")]
  expect(WorkspaceEdit.apply(content, edits)).toBe("fresh(fresh, fresh)")
})

test("apply handles edits across lines regardless of input order", () => {
  const content = "one\ntwo\nthree\n"
  const edits = [edit([2, 0], [2, 5], "3"), edit([0, 0], [0, 3], "1")]
  expect(WorkspaceEdit.apply(content, edits)).toBe("1\ntwo\n3\n")
})

test("apply supports insertions and multi-line replacements", () => {
  const content = "function f() {\n  return 1\n}\n"
  const insertion = edit([0, 0], [0, 0], "// header\n")
  const replacement = edit([1, 2], [2, 0], "return 2\n")
  expect(WorkspaceEdit.apply(content, [insertion, replacement])).toBe("// header\nfunction f() {\n  return 2\n}\n")
})

test("collect merges the changes map", () => {
  const result = WorkspaceEdit.collect({
    changes: {
      "file:///a.ts": [edit([0, 0], [0, 3], "x")],
      "file:///b.ts": [edit([1, 0], [1, 3], "y")],
    },
  })
  expect(Object.keys(result).sort()).toEqual(["file:///a.ts", "file:///b.ts"])
  expect(result["file:///a.ts"]).toHaveLength(1)
})

test("collect flattens documentChanges and skips resource operations", () => {
  const result = WorkspaceEdit.collect({
    documentChanges: [
      {
        textDocument: { uri: "file:///a.ts", version: 3 },
        edits: [edit([0, 0], [0, 3], "x"), edit([2, 0], [2, 3], "y")],
      },
      { kind: "create", uri: "file:///new.ts" },
      { kind: "rename", oldUri: "file:///a.ts", newUri: "file:///c.ts" },
    ],
  })
  expect(Object.keys(result)).toEqual(["file:///a.ts"])
  expect(result["file:///a.ts"]).toHaveLength(2)
})

test("collect concatenates changes and documentChanges for the same uri", () => {
  const result = WorkspaceEdit.collect({
    changes: { "file:///a.ts": [edit([0, 0], [0, 1], "x")] },
    documentChanges: [{ textDocument: { uri: "file:///a.ts", version: 1 }, edits: [edit([1, 0], [1, 1], "y")] }],
  })
  expect(result["file:///a.ts"]).toHaveLength(2)
})

test("collect returns an empty record for an empty workspace edit", () => {
  expect(WorkspaceEdit.collect({})).toEqual({})
})
