import { describe, expect, test } from "bun:test"
import { modules, report, states } from "../../src/cli/cmd/submodules"

const GITMODULES = [
  '[submodule "vendor/lib"]',
  "\tpath = vendor/lib",
  "\turl = https://example.com/lib.git",
  "\tbranch = main",
  "",
  '[submodule "tools"]',
  "  path = tools",
  "  url = git@example.com:tools.git",
].join("\n")

const SHA = "1234567890abcdef1234567890abcdef12345678"

describe("modules", () => {
  test("parses names, paths, urls, and branches", () => {
    const found = modules(GITMODULES)
    expect(found).toHaveLength(2)
    expect(found[0]).toEqual({
      name: "vendor/lib",
      path: "vendor/lib",
      url: "https://example.com/lib.git",
      branch: "main",
    })
    expect(found[1].branch).toBeUndefined()
  })

  test("skips entries missing a path or url", () => {
    expect(modules('[submodule "broken"]\n\turl = x')).toEqual([])
  })

  test("ignores comments and blank lines", () => {
    expect(modules("# comment\n\n; other")).toEqual([])
  })
})

describe("states", () => {
  test("parses each status prefix", () => {
    const text = [
      ` ${SHA} vendor/lib (v1.0)`,
      `-${SHA} tools`,
      `+${SHA} extra (heads/main)`,
      `U${SHA} conflicted`,
    ].join("\n")
    const found = states(text)
    expect(found.map((state) => state.status)).toEqual(["ok", "uninitialized", "drifted", "conflicted"])
    expect(found[0].path).toBe("vendor/lib")
    expect(found[0].sha).toBe(SHA)
  })

  test("ignores unrelated lines", () => {
    expect(states("fatal: not a git repository")).toEqual([])
  })
})

describe("report", () => {
  test("adds declared submodules missing from status as uninitialized", () => {
    const declared = modules(GITMODULES)
    const observed = states(` ${SHA} vendor/lib`)
    const rows = report(declared, observed)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toEqual({ path: "tools", sha: "", status: "uninitialized" })
  })

  test("keeps observed rows as-is when everything is declared", () => {
    const declared = modules(GITMODULES)
    const observed = states(` ${SHA} vendor/lib\n ${SHA} tools`)
    expect(report(declared, observed)).toEqual(observed)
  })
})
