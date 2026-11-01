import { describe, expect, test } from "bun:test"
import { churn, complexity, hotspots, markdown, rename } from "../../src/cli/cmd/hotspots"

const TANGLED = [
  "export function route(input: Request) {",
  "  if (input.method === method) {",
  "    for (const rule of rules) {",
  "      if (rule.match(input) && rule.enabled) {",
  "        return rule.handle(input)",
  "      }",
  "    }",
  "  }",
  "  return missing(input)",
  "}",
].join("\n")

describe("rename", () => {
  test("resolves numstat rename notation to the new path", () => {
    expect(rename("src/{old => new}/file.ts")).toBe("src/new/file.ts")
    expect(rename("old.ts => new.ts")).toBe("new.ts")
    expect(rename("src/plain.ts")).toBe("src/plain.ts")
    expect(rename("src/{ => cmd}/file.ts")).toBe("src/cmd/file.ts")
  })
})

describe("churn", () => {
  test("counts commits and line changes per file", () => {
    const log = ["abc123", "", "10\t2\tsrc/a.ts", "3\t3\tsrc/b.ts", "def456", "", "1\t1\tsrc/a.ts"].join("\n")
    const result = churn(log)
    expect(result.get("src/a.ts")).toEqual({ commits: 2, changes: 14 })
    expect(result.get("src/b.ts")).toEqual({ commits: 1, changes: 6 })
  })

  test("treats binary markers as zero-line changes", () => {
    expect(churn("-\t-\tlogo.png").get("logo.png")).toEqual({ commits: 1, changes: 0 })
  })

  test("merges churn across renames", () => {
    const log = ["5\t0\tsrc/{old => new}/a.ts", "2\t1\tsrc/new/a.ts"].join("\n")
    expect(churn(log).get("src/new/a.ts")).toEqual({ commits: 2, changes: 8 })
  })
})

describe("complexity", () => {
  test("scores branching and nesting above flat code", () => {
    expect(complexity(TANGLED)).toBeGreaterThan(complexity("export const table = [1, 2, 3]"))
  })

  test("counts branch keywords and boolean operators", () => {
    expect(complexity("if (a && b || c) {}")).toBe(3)
  })

  test("scores empty text as zero", () => {
    expect(complexity("")).toBe(0)
  })
})

describe("hotspots", () => {
  const files = { "hot.ts": TANGLED, "flat.ts": "export const value = 1", "cold.ts": TANGLED }
  const touched = new Map([
    ["hot.ts", { commits: 9, changes: 200 }],
    ["flat.ts", { commits: 9, changes: 200 }],
    ["cold.ts", { commits: 1, changes: 4 }],
  ])

  test("requires both churn and complexity", () => {
    const spots = hotspots(touched, files)
    expect(spots.map((spot) => spot.file)).toEqual(["hot.ts"])
    expect(spots[0].score).toBe(9 * complexity(TANGLED))
  })

  test("ignores files missing from the churn map", () => {
    expect(hotspots(new Map(), files)).toEqual([])
  })

  test("ranks by score descending", () => {
    const busy = new Map([
      ["hot.ts", { commits: 3, changes: 10 }],
      ["cold.ts", { commits: 30, changes: 100 }],
    ])
    expect(hotspots(busy, files).map((spot) => spot.file)).toEqual(["cold.ts", "hot.ts"])
  })
})

describe("markdown", () => {
  test("renders the ranked table", () => {
    const spots = hotspots(new Map([["hot.ts", { commits: 9, changes: 200 }]]), { "hot.ts": TANGLED })
    const text = markdown(spots, "90 days")
    expect(text).toContain("| File | Commits | Lines changed | Complexity | Score |")
    expect(text).toContain("| `hot.ts` | 9 | 200 |")
  })

  test("says so when nothing is hot", () => {
    expect(markdown([], "30 days")).toContain("No files with both high churn and high complexity in the last 30 days.")
  })

  test("caps output at the limit", () => {
    const spots = hotspots(
      new Map([
        ["hot.ts", { commits: 9, changes: 200 }],
        ["cold.ts", { commits: 5, changes: 50 }],
      ]),
      { "hot.ts": TANGLED, "cold.ts": TANGLED },
    )
    expect(markdown(spots, "90 days", 1)).not.toContain("`cold.ts`")
  })
})
