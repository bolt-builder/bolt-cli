import { describe, expect, test } from "bun:test"
import { relevant } from "../../src/cli/cmd/watch"

describe("relevant", () => {
  test("accepts source files", () => {
    expect(relevant("src/session/prompt.ts")).toBe(true)
    expect(relevant("README.md")).toBe(true)
  })

  test("ignores vcs and dependency directories", () => {
    expect(relevant(".git/HEAD")).toBe(false)
    expect(relevant("node_modules/effect/package.json")).toBe(false)
    expect(relevant("packages/opencode/node_modules/a/b.js")).toBe(false)
  })

  test("ignores build output", () => {
    expect(relevant("dist/index.js")).toBe(false)
    expect(relevant("build/out.txt")).toBe(false)
    expect(relevant(".turbo/turbo-build.log")).toBe(false)
    expect(relevant(".cache/x")).toBe(false)
  })

  test("handles windows separators", () => {
    expect(relevant("node_modules\\pkg\\index.js")).toBe(false)
    expect(relevant("src\\index.ts")).toBe(true)
  })

  test("does not skip files merely named like skip directories", () => {
    expect(relevant("src/dist.ts")).toBe(true)
    expect(relevant("docs/node_modules.md")).toBe(true)
  })
})
