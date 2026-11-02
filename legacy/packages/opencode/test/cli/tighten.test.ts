import { describe, expect, test } from "bun:test"
import { loose } from "../../src/cli/cmd/tighten"

describe("loose", () => {
  test("finds any annotations", () => {
    const findings = loose("function parse(input: any) {}")
    expect(findings).toHaveLength(1)
    expect(findings[0].kind).toBe(": any")
  })

  test("finds any assertions and double assertions", () => {
    const findings = loose("const a = value as any\nconst b = value as unknown as Config")
    expect(findings.map((finding) => finding.kind)).toEqual(["as any", "as unknown"])
  })

  test("finds any arrays and any type arguments", () => {
    const findings = loose("const list: any[] = []\nconst map = new Map<any, string>()")
    expect(findings.map((finding) => finding.kind)).toEqual([": any", "any[]", "<any>"])
  })

  test("finds Function and object annotations", () => {
    const findings = loose("let callback: Function\nlet bag: object")
    expect(findings.map((finding) => finding.kind)).toEqual([": Function", ": object"])
  })

  test("finds suppression comments", () => {
    const findings = loose("// @ts-expect-error legacy\nconst a = 1")
    expect(findings).toHaveLength(1)
    expect(findings[0].kind).toBe("suppression")
  })

  test("skips code patterns inside comments", () => {
    expect(loose("// the old signature was (input: any) => void")).toEqual([])
  })

  test("does not flag identifiers containing any", () => {
    expect(loose("const company = getCompany()\nconst many = 3")).toEqual([])
  })

  test("reports one-based lines and trimmed text", () => {
    const findings = loose("const a = 1\n  const b = value as any")
    expect(findings).toEqual([{ line: 2, kind: "as any", text: "const b = value as any" }])
  })

  test("returns empty for tight code", () => {
    expect(loose("const parse = (input: string): number => input.length")).toEqual([])
  })
})
