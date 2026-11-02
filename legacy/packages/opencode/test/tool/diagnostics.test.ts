import { test, expect } from "bun:test"
import { filter, format, label, render, within } from "@/tool/diagnostics"
import type { LSPClient } from "@/lsp/client"

function make(input: {
  line: number
  character?: number
  severity?: number
  message?: string
  source?: string
}): LSPClient.Diagnostic {
  return {
    range: {
      start: { line: input.line, character: input.character ?? 0 },
      end: { line: input.line, character: (input.character ?? 0) + 1 },
    },
    severity: input.severity as LSPClient.Diagnostic["severity"],
    message: input.message ?? "boom",
    source: input.source,
  }
}

test("label maps LSP severity codes and defaults to error", () => {
  expect(label(1)).toBe("error")
  expect(label(2)).toBe("warning")
  expect(label(3)).toBe("info")
  expect(label(4)).toBe("hint")
  expect(label(undefined)).toBe("error")
  expect(label(99)).toBe("error")
})

test("within matches the path itself and descendants only", () => {
  expect(within("/repo/src/a.ts", "/repo/src/a.ts")).toBe(true)
  expect(within("/repo/src/a.ts", "/repo/src")).toBe(true)
  expect(within("/repo/src/deep/b.ts", "/repo")).toBe(true)
  expect(within("/repo/srcfoo/a.ts", "/repo/src")).toBe(false)
  expect(within("/other/a.ts", "/repo")).toBe(false)
})

test("filter scopes by path", () => {
  const all = {
    "/repo/src/a.ts": [make({ line: 0 })],
    "/repo/test/b.ts": [make({ line: 1 })],
  }
  const result = filter(all, { path: "/repo/src" })
  expect(Object.keys(result)).toEqual(["/repo/src/a.ts"])
})

test("filter scopes by severity and drops empty files", () => {
  const all = {
    "/repo/a.ts": [make({ line: 0, severity: 1 }), make({ line: 2, severity: 2 })],
    "/repo/b.ts": [make({ line: 5, severity: 2 })],
  }
  const result = filter(all, { severity: "error" })
  expect(Object.keys(result)).toEqual(["/repo/a.ts"])
  expect(result["/repo/a.ts"]).toHaveLength(1)
  expect(result["/repo/a.ts"][0].severity).toBe(1)
})

test("filter sorts files by name and diagnostics by position", () => {
  const all = {
    "/repo/b.ts": [make({ line: 9 })],
    "/repo/a.ts": [make({ line: 4, character: 8 }), make({ line: 4, character: 2 }), make({ line: 1 })],
  }
  const result = filter(all, {})
  expect(Object.keys(result)).toEqual(["/repo/a.ts", "/repo/b.ts"])
  const positions = result["/repo/a.ts"].map((item) => [item.range.start.line, item.range.start.character])
  expect(positions).toEqual([
    [1, 0],
    [4, 2],
    [4, 8],
  ])
})

test("format renders file:line:col severity message with 1-based positions", () => {
  const output = format("src/a.ts", make({ line: 3, character: 7, severity: 2, message: "unused variable" }))
  expect(output).toBe("src/a.ts:4:8 warning unused variable")
})

test("format appends the source when present", () => {
  const output = format("src/a.ts", make({ line: 0, severity: 1, message: "type error", source: "typescript" }))
  expect(output).toBe("src/a.ts:1:1 error type error [typescript]")
})

test("render summarizes counts and lists every diagnostic", () => {
  const output = render({
    "a.ts": [make({ line: 0, severity: 1, message: "first" })],
    "b.ts": [make({ line: 1, severity: 2, message: "second" }), make({ line: 2, severity: 4, message: "third" })],
  })
  expect(output).toBe(
    ["3 diagnostics in 2 files:", "a.ts:1:1 error first", "b.ts:2:1 warning second", "b.ts:3:1 hint third"].join("\n"),
  )
})

test("render reports when nothing matched", () => {
  expect(render({})).toBe("No diagnostics found.")
})
