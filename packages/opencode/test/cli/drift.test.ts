import { describe, expect, test } from "bun:test"
import { classify, comment, docfile, removed } from "../../src/cli/cmd/drift"

describe("removed", () => {
  test("extracts deleted declarations with their file", () => {
    const diff = [
      "diff --git a/src/parser.ts b/src/parser.ts",
      "--- a/src/parser.ts",
      "+++ b/src/parser.ts",
      "@@ -1,3 +1,1 @@",
      "-export function parseLegacy(text: string) {",
      "-  return text",
      "-}",
      "+export function parse(text: string) {",
    ].join("\n")
    expect(removed(diff)).toEqual([{ file: "src/parser.ts", name: "parseLegacy" }])
  })

  test("supports classes, consts, types, and python defs", () => {
    const diff = [
      "--- a/src/mixed.ts",
      "-export class Runner {",
      "-export const LIMIT = 5",
      "-export type Entry = string",
      "--- a/tool/script.py",
      "-def build(target):",
    ].join("\n")
    expect(removed(diff).map((entry) => entry.name)).toEqual(["Runner", "LIMIT", "Entry", "build"])
  })

  test("ignores added lines and context lines", () => {
    const diff = "--- a/src/a.ts\n+export function added() {}\n export function context() {}"
    expect(removed(diff)).toEqual([])
  })

  test("ignores deleted lines that are not declarations", () => {
    expect(removed("--- a/src/a.ts\n-  return total + 1")).toEqual([])
  })

  test("dedupes symbols deleted in several hunks", () => {
    const diff = "--- a/src/a.ts\n-export function twice() {\n--- a/src/b.ts\n-export function twice() {"
    expect(removed(diff)).toHaveLength(1)
  })
})

describe("docfile", () => {
  test("recognizes markdown family files", () => {
    expect(docfile("README.md")).toBe(true)
    expect(docfile("docs/guide.mdx")).toBe(true)
    expect(docfile("notes.rst")).toBe(true)
  })

  test("rejects source files", () => {
    expect(docfile("src/readme-generator.ts")).toBe(false)
  })
})

describe("comment", () => {
  test("recognizes comment lines", () => {
    expect(comment("  // parseLegacy handles old input")).toBe(true)
    expect(comment(" * See parseLegacy for details.")).toBe(true)
    expect(comment("# uses parseLegacy under the hood")).toBe(true)
  })

  test("rejects code lines", () => {
    expect(comment("const legacy = parseLegacy(input)")).toBe(false)
  })
})

describe("classify", () => {
  test("alive when referenced by live code", () => {
    const outcome = classify([
      { path: "src/caller.ts", line: 3, text: "parseLegacy(input)" },
      { path: "README.md", line: 10, text: "Use parseLegacy for old files." },
    ])
    expect(outcome.alive).toBe(true)
    expect(outcome.mentions).toHaveLength(1)
  })

  test("stale when only docs and comments mention it", () => {
    const outcome = classify([
      { path: "README.md", line: 10, text: "Use parseLegacy for old files." },
      { path: "src/parser.ts", line: 2, text: "// parseLegacy used to live here" },
    ])
    expect(outcome.alive).toBe(false)
    expect(outcome.mentions).toHaveLength(2)
  })

  test("clean when nothing references it", () => {
    const outcome = classify([])
    expect(outcome.alive).toBe(false)
    expect(outcome.mentions).toEqual([])
  })
})
