import { describe, expect, test } from "bun:test"
import { bucket, graph, imports, markdown } from "../../src/cli/cmd/map"

describe("bucket", () => {
  test("aggregates to the requested directory depth", () => {
    expect(bucket("src/cli/cmd/map.ts", 2)).toBe("src/cli")
    expect(bucket("src/cli/cmd/map.ts", 1)).toBe("src")
    expect(bucket("src/cli/cmd/map.ts", 9)).toBe("src/cli/cmd")
    expect(bucket("index.ts", 2)).toBe(".")
  })
})

describe("imports", () => {
  test("resolves relative specifiers against known files", () => {
    const known = new Set(["src/cli/cmd/map.ts", "src/util/html.ts", "src/session/index.ts", "src/cli/ui.ts"])
    const text = [
      'import { escapeHtml } from "../../util/html"',
      'import { Session } from "../../session"',
      'const lazy = await import("../ui.js")',
      'import { Effect } from "effect"',
      'import missing from "./nope"',
    ].join("\n")
    expect(imports("src/cli/cmd/map.ts", text, known)).toEqual([
      "src/util/html.ts",
      "src/session/index.ts",
      "src/cli/ui.ts",
    ])
  })
})

describe("graph", () => {
  const files = {
    "src/cli/cmd/map.ts": ["src/util/html.ts", "src/cli/ui.ts"],
    "src/cli/ui.ts": ["src/util/html.ts"],
    "src/util/html.ts": [],
    "src/util/glob.ts": ["src/util/html.ts"],
    "index.ts": ["src/cli/cmd/map.ts"],
  }

  test("counts files per directory bucket", () => {
    expect(graph(files, 2).counts).toEqual({ "src/cli": 2, "src/util": 2, ".": 1 })
  })

  test("dedupes edges and drops self-loops", () => {
    expect(graph(files, 2).edges).toEqual([
      { from: ".", to: "src/cli" },
      { from: "src/cli", to: "src/util" },
    ])
  })

  test("collapses everything at depth 1", () => {
    expect(graph(files, 1).edges).toEqual([{ from: ".", to: "src" }])
    expect(graph(files, 1).counts).toEqual({ src: 4, ".": 1 })
  })

  test("caps the edge list at 60", () => {
    const wide = Object.fromEntries(
      Array.from({ length: 80 }, (_, index) => [`a${index}/file.ts`, [`b${index}/file.ts`]]),
    )
    expect(graph(wide, 2).edges.length).toBe(60)
  })
})

describe("markdown", () => {
  test("emits a mermaid graph and a file count table", () => {
    const result = graph(
      {
        "src/cli/cmd/map.ts": ["src/util/html.ts"],
        "src/util/html.ts": [],
      },
      2,
    )
    const text = markdown(result)
    expect(text).toContain("```mermaid")
    expect(text).toContain("graph TD")
    expect(text).toContain('d0["src/cli"]')
    expect(text).toContain('d1["src/util"]')
    expect(text).toContain("d0 --> d1")
    expect(text).toContain("| Directory | Files |")
    expect(text).toContain("| `src/cli` | 1 |")
    expect(text).toContain("| `src/util` | 1 |")
  })
})
