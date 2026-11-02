import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { LspGraph } from "@/lsp/graph"
import type { LSP } from "@/lsp/lsp"

describe("lsp.graph.format", () => {
  test("renders symbols with their referencing files", () => {
    const output = LspGraph.format({
      file: "src/foo.ts",
      nodes: [
        {
          name: "parse",
          refs: [
            { file: "src/bar.ts", count: 3 },
            { file: "src/baz.ts", count: 1 },
          ],
        },
        { name: "render", refs: [{ file: "src/app.ts", count: 2 }] },
      ],
    })
    expect(output).toContain('<symbol-graph file="src/foo.ts">')
    expect(output).toContain("parse <- src/bar.ts (3), src/baz.ts (1)")
    expect(output).toContain("render <- src/app.ts (2)")
    expect(output).toContain("</symbol-graph>")
  })

  test("drops symbols without external references", () => {
    const output = LspGraph.format({
      file: "src/foo.ts",
      nodes: [
        { name: "internal", refs: [] },
        { name: "shared", refs: [{ file: "src/bar.ts", count: 1 }] },
      ],
    })
    expect(output).not.toContain("internal")
    expect(output).toContain("shared <- src/bar.ts (1)")
  })

  test("renders empty when nothing is referenced across files", () => {
    expect(LspGraph.format({ file: "src/foo.ts", nodes: [{ name: "a", refs: [] }] })).toBe("")
    expect(LspGraph.format({ file: "src/foo.ts", nodes: [] })).toBe("")
  })
})

describe("lsp.graph.build", () => {
  test("groups external references per symbol and excludes the file itself", async () => {
    const lsp = {
      documentSymbol: () =>
        Effect.succeed([
          {
            name: "parse",
            kind: 12,
            range: { start: { line: 0, character: 0 }, end: { line: 5, character: 0 } },
            selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 21 } },
          },
        ]),
      references: () =>
        Effect.succeed([
          { uri: "file:///repo/src/bar.ts", range: {} },
          { uri: "file:///repo/src/bar.ts", range: {} },
          { uri: "file:///repo/src/foo.ts", range: {} },
          { uri: "untitled:whatever", range: {} },
        ]),
    } as unknown as LSP.Interface

    const output = await Effect.runPromise(LspGraph.build({ lsp, file: "/repo/src/foo.ts", root: "/repo" }))
    expect(output).toContain('<symbol-graph file="src/foo.ts">')
    expect(output).toContain("parse <- src/bar.ts (2)")
    expect(output).not.toContain("foo.ts (")
  })

  test("renders empty when the file has no symbols", async () => {
    const lsp = {
      documentSymbol: () => Effect.succeed([]),
      references: () => Effect.succeed([]),
    } as unknown as LSP.Interface
    const output = await Effect.runPromise(LspGraph.build({ lsp, file: "/repo/src/foo.ts", root: "/repo" }))
    expect(output).toBe("")
  })
})
