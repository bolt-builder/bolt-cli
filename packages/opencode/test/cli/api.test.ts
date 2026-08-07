import { describe, expect, test } from "bun:test"
import { block, diff, markdown, signature, surface } from "../../src/cli/cmd/api"

describe("signature", () => {
  test("drops function bodies and collapses whitespace", () => {
    const lines = ["export function parse(raw: string): Config {", "  return JSON.parse(raw)", "}"]
    expect(signature(lines, 0)).toBe("export function parse(raw: string): Config")
  })

  test("joins multi-line parameter lists until parens balance", () => {
    const lines = ["export function merge(", "  left: Config,", "  right: Config,", "): Config {", "  return left", "}"]
    expect(signature(lines, 0)).toBe("export function merge( left: Config, right: Config, ): Config")
  })

  test("drops arrow bodies and trailing assignment", () => {
    expect(signature(["export const run = (input: string) => input.trim()"], 0)).toBe("export const run = (input: string)")
    expect(signature(["export const flag ="], 0)).toBe("export const flag")
  })
})

describe("block", () => {
  test("keeps interface bodies until braces balance", () => {
    const lines = ["export interface Config {", "  name: string", "  retries: number", "}", "const after = 1"]
    expect(block(lines, 0)).toBe("export interface Config { name: string retries: number }")
  })

  test("stops braceless type aliases at the first non-continuation line", () => {
    const lines = ["export type Mode = read | write", "const next = 1"]
    expect(block(lines, 0)).toBe("export type Mode = read | write")
  })
})

describe("surface", () => {
  test("extracts exported declarations with structural bodies", () => {
    const items = surface({
      "a.ts": ["export function go(x: number) {", "}", "export interface Shape {", "  width: number", "}"].join("\n"),
    })
    expect(items).toEqual([
      { file: "a.ts", name: "go", signature: "export function go(x: number)" },
      { file: "a.ts", name: "Shape", signature: "export interface Shape { width: number }" },
    ])
  })

  test("ignores non-exported declarations", () => {
    expect(surface({ "a.ts": "function hidden() {}\nconst secret = 1" })).toEqual([])
  })
})

describe("diff", () => {
  const old = surface({ "a.ts": "export function go(x: number) {}\nexport interface Shape {\n  width: number\n}" })

  test("reports nothing for identical surfaces", () => {
    const delta = diff(old, old)
    expect(delta).toEqual({ added: [], removed: [], changed: [] })
  })

  test("flags signature changes with before and after", () => {
    const now = surface({ "a.ts": "export function go(x: string) {}\nexport interface Shape {\n  width: number\n}" })
    const delta = diff(old, now)
    expect(delta.changed).toEqual([
      { file: "a.ts", name: "go", before: "export function go(x: number)", after: "export function go(x: string)" },
    ])
  })

  test("flags interface body changes as surface changes", () => {
    const now = surface({ "a.ts": "export function go(x: number) {}\nexport interface Shape {\n  width: number\n  height: number\n}" })
    expect(diff(old, now).changed.map((change) => change.name)).toEqual(["Shape"])
  })

  test("ignores function body changes", () => {
    const now = surface({ "a.ts": "export function go(x: number) { return x + 1 }\nexport interface Shape {\n  width: number\n}" })
    expect(diff(old, now)).toEqual({ added: [], removed: [], changed: [] })
  })

  test("reports additions and removals", () => {
    const now = surface({ "a.ts": "export function go(x: number) {}\nexport const fresh = 1" })
    const delta = diff(old, now)
    expect(delta.added.map((item) => item.name)).toEqual(["fresh"])
    expect(delta.removed.map((item) => item.name)).toEqual(["Shape"])
  })
})

describe("markdown", () => {
  test("orders breaking sections before additions", () => {
    const old = surface({ "a.ts": "export const gone = 1\nexport function go(x: number) {}" })
    const now = surface({ "a.ts": "export function go(x: string) {}\nexport const fresh = 1" })
    const text = markdown(diff(old, now), "v1.0.0")
    expect(text).toContain("Compared against v1.0.0: 2 breaking, 1 added.")
    expect(text.indexOf("## Removed (breaking)")).toBeLessThan(text.indexOf("## Changed (breaking)"))
    expect(text.indexOf("## Changed (breaking)")).toBeLessThan(text.indexOf("## Added"))
    expect(text).toContain("- `gone` in `a.ts`")
    expect(text).toContain("  - before: `export function go(x: number)`")
  })

  test("says so when the surface is unchanged", () => {
    expect(markdown({ added: [], removed: [], changed: [] }, "HEAD")).toContain("No public surface changes against HEAD.")
  })
})
