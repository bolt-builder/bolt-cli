import { describe, expect, test } from "bun:test"
import { markdown, nodes, order } from "../../src/cli/cmd/packages"

const WORKSPACE = {
  "packages/core/package.json": { name: "core", dependencies: { schema: "*", effect: "^3.0.0" } },
  "packages/schema/package.json": { name: "schema" },
  "packages/server/package.json": {
    name: "server",
    dependencies: { core: "*", schema: "*" },
    devDependencies: { schema: "*" },
  },
  "package.json": { name: "root", dependencies: {} },
}

describe("nodes", () => {
  test("keeps only internal dependencies as edges", () => {
    const graph = nodes(WORKSPACE)
    const core = graph.find((node) => node.name === "core")
    expect(core?.deps).toEqual(["schema"])
    expect(core?.dir).toBe("packages/core")
  })

  test("merges dependency kinds without duplicates", () => {
    const server = nodes(WORKSPACE).find((node) => node.name === "server")
    expect(server?.deps).toEqual(["core", "schema"])
  })

  test("skips manifests without a name and self-dependencies", () => {
    const graph = nodes({
      "a/package.json": { private: true },
      "b/package.json": { name: "b", dependencies: { b: "*" } },
    })
    expect(graph).toEqual([{ name: "b", dir: "b", deps: [] }])
  })
})

describe("order", () => {
  test("levels packages so each depends only on earlier levels", () => {
    const built = order(nodes(WORKSPACE))
    expect(built.levels).toEqual([["root", "schema"], ["core"], ["server"]])
    expect(built.cyclic).toEqual([])
  })

  test("reports cyclic packages instead of looping", () => {
    const built = order([
      { name: "a", dir: "a", deps: ["b"] },
      { name: "b", dir: "b", deps: ["a"] },
      { name: "c", dir: "c", deps: [] },
    ])
    expect(built.levels).toEqual([["c"]])
    expect(built.cyclic).toEqual(["a", "b"])
  })
})

describe("markdown", () => {
  test("renders mermaid edges and the build order table", () => {
    const graph = nodes(WORKSPACE)
    const text = markdown(graph, order(graph))
    expect(text).toContain("```mermaid")
    expect(text).toContain('["server"]')
    expect(text).toContain("| 1 | `root`, `schema` |")
    expect(text).toContain("| 3 | `server` |")
    expect(text).not.toContain("## Dependency cycles")
  })

  test("calls out cycles", () => {
    const graph = [
      { name: "a", dir: "a", deps: ["b"] },
      { name: "b", dir: "b", deps: ["a"] },
    ]
    expect(markdown(graph, order(graph))).toContain("No valid build order for: `a`, `b`")
  })

  test("handles an empty workspace", () => {
    expect(markdown([], { levels: [], cyclic: [] })).toContain("No workspace packages found.")
  })
})
