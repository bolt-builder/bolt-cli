import { describe, expect, test } from "bun:test"
import { exports, identifiers, imported, markdown, radar, starred } from "../../src/cli/cmd/dead"

describe("exports", () => {
  test("finds declaration exports with line numbers", () => {
    const text = [
      "const local = 1",
      "export const alpha = 1",
      "export async function beta() {}",
      "export interface Gamma {}",
    ].join("\n")
    expect(exports("a.ts", text)).toEqual([
      { file: "a.ts", name: "alpha", line: 2 },
      { file: "a.ts", name: "beta", line: 3 },
      { file: "a.ts", name: "Gamma", line: 4 },
    ])
  })

  test("finds export lists and honors aliases", () => {
    expect(exports("a.ts", "export { alpha, beta as gamma }")).toEqual([
      { file: "a.ts", name: "alpha", line: 1 },
      { file: "a.ts", name: "gamma", line: 1 },
    ])
  })

  test("ignores re-export lists with a from clause", () => {
    expect(exports("a.ts", 'export { alpha } from "./other"')).toEqual([])
  })
})

describe("imported", () => {
  test("collects names from import and re-export clauses", () => {
    const text = [
      'import { alpha, beta as local } from "./a"',
      'export { gamma } from "./b"',
      'import type { Delta } from "./c"',
    ].join("\n")
    expect(imported(text)).toEqual(["alpha", "beta", "gamma", "Delta"])
  })
})

describe("starred", () => {
  test("resolves star re-export targets and skips self re-exports", () => {
    const known = new Set(["a.ts", "lib/b.ts"])
    expect(starred("a.ts", 'export * from "./lib/b"', known)).toEqual(["lib/b.ts"])
    expect(starred("lib/b.ts", 'export * as B from "./b"', known)).toEqual([])
    expect(starred("a.ts", 'export * from "external"', known)).toEqual([])
  })
})

describe("identifiers", () => {
  test("counts identifier occurrences", () => {
    const counts = identifiers("alpha(alpha, beta)")
    expect(counts.get("alpha")).toBe(2)
    expect(counts.get("beta")).toBe(1)
  })
})

describe("radar", () => {
  test("never reports exports that are imported somewhere", () => {
    const findings = radar({
      "a.ts": "export const alpha = 1\nexport const orphan = 2",
      "b.ts": 'import { alpha } from "./a"\nconsole.log(alpha)',
    })
    expect(findings.map((finding) => finding.name)).toEqual(["orphan"])
    expect(findings[0].score).toBe(100)
    expect(findings[0].line).toBe(2)
  })

  test("penalizes names mentioned in other files", () => {
    const findings = radar({
      "a.ts": "export const orphan = 1",
      "b.ts": "const thing = { orphan: true }\nthing.orphan",
    })
    expect(findings[0].score).toBe(40)
    expect(findings[0].reasons).toEqual(["name mentioned 2x outside its file"])
  })

  test("penalizes star re-exported files, index files, and test files", () => {
    const findings = radar({
      "lib/index.ts": "export const orphan = 1",
      "barrel.ts": 'export * from "./lib/index"',
      "test/helper.test.ts": "export const lonely = 1",
    })
    const orphan = findings.find((finding) => finding.name === "orphan")
    expect(orphan?.score).toBe(30)
    expect(orphan?.reasons).toEqual(["file is star re-exported", "index entrypoint"])
    const lonely = findings.find((finding) => finding.name === "lonely")
    expect(lonely?.score).toBe(80)
    expect(lonely?.reasons).toEqual(["test file"])
  })

  test("flags exports still used inside their own file", () => {
    const findings = radar({ "a.ts": "export function orphan() {}\norphan()" })
    expect(findings[0].score).toBe(90)
    expect(findings[0].reasons).toEqual(["used inside its own file; only the export keyword is dead"])
  })

  test("sorts safest deletions first", () => {
    const findings = radar({
      "a.ts": "export const safe = 1",
      "b.ts": "export const risky = 1",
      "c.ts": "const shape = { risky: 1 }",
    })
    expect(findings.map((finding) => finding.name)).toEqual(["safe", "risky"])
  })
})

describe("markdown", () => {
  test("renders a safety-ordered table", () => {
    const text = markdown(radar({ "a.ts": "export const orphan = 1" }))
    expect(text).toContain("# Dead code radar")
    expect(text).toContain("| Export | Location | Safety | Notes |")
    expect(text).toContain("| `orphan` | `a.ts:1` | 100 | no references anywhere |")
  })

  test("says so when everything is used", () => {
    expect(markdown([])).toContain("No unused exports found.")
  })

  test("caps output at the limit", () => {
    const findings = radar({ "a.ts": "export const one = 1\nexport const two = 2" })
    expect(markdown(findings, 1)).not.toContain("`two`")
  })
})
