import { describe, expect, test } from "bun:test"
import { changed, dead, exported } from "../../src/cli/cmd/analyze"

describe("changed", () => {
  test("extracts changed file paths from a unified diff", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1 +1 @@",
      "diff --git a/src/b.ts b/src/b.ts",
      "+++ b/src/b.ts",
    ].join("\n")
    expect(changed(diff)).toEqual(["src/a.ts", "src/b.ts"])
  })

  test("skips deletions targeting /dev/null", () => {
    const diff = "--- a/src/gone.ts\n+++ /dev/null"
    expect(changed(diff)).toEqual([])
  })

  test("dedupes repeated paths", () => {
    expect(changed("+++ b/src/a.ts\n+++ b/src/a.ts")).toEqual(["src/a.ts"])
  })

  test("ignores added lines that merely start with plus signs", () => {
    expect(changed("+++ not a header\n+const a = 1")).toEqual([])
  })
})

describe("exported", () => {
  test("finds functions, consts, classes, and types", () => {
    const source = [
      "export function parse(text: string) {}",
      "export const LIMIT = 5",
      "export class Runner {}",
      "export type Entry = { a: number }",
      "export interface Options {}",
    ].join("\n")
    expect(exported(source).map((symbol) => symbol.name)).toEqual(["parse", "LIMIT", "Runner", "Entry", "Options"])
  })

  test("finds namespace reexports and export lists", () => {
    const source = 'export * as Foo from "./foo"\nexport { alpha, beta as gamma }'
    expect(exported(source)).toEqual([
      { name: "Foo", line: 1 },
      { name: "alpha", line: 2 },
      { name: "gamma", line: 2 },
    ])
  })

  test("skips default exports and unexported declarations", () => {
    const source = "export default function main() {}\nfunction helper() {}\nexport { default }"
    expect(exported(source)).toEqual([])
  })

  test("reports one-based line numbers", () => {
    const source = "const a = 1\n\nexport const b = 2"
    expect(exported(source)).toEqual([{ name: "b", line: 3 }])
  })
})

describe("dead", () => {
  test("dead when all references are in the defining file", () => {
    expect(dead("src/a.ts", ["src/a.ts", "src/a.ts"])).toBe(true)
  })

  test("alive when any reference is elsewhere", () => {
    expect(dead("src/a.ts", ["src/a.ts", "test/a.test.ts"])).toBe(false)
  })

  test("dead when there are no references at all", () => {
    expect(dead("src/a.ts", [])).toBe(true)
  })

  test("normalizes windows separators", () => {
    expect(dead("src/a.ts", ["src\\a.ts"])).toBe(true)
  })
})
