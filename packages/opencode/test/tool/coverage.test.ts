import { describe, expect, test } from "bun:test"
import { pattern, relevant, render } from "../../src/tool/coverage"

describe("pattern", () => {
  test("builds the conventional test pattern for a source file", () => {
    expect(pattern("src/cli/cmd/review.ts")).toBe("**/{review.test,review.spec,review_test,test_review}.*")
  })

  test("uses the basename without its extension", () => {
    expect(pattern("pkg/util/glob.go")).toBe("**/{glob.test,glob.spec,glob_test,test_glob}.*")
  })

  test("returns undefined for an empty basename", () => {
    expect(pattern("")).toBeUndefined()
  })
})

describe("relevant", () => {
  test("drops node_modules and .git matches", () => {
    const matches = [
      "test/cli/review.test.ts",
      "node_modules/pkg/review.test.ts",
      ".git/review.test.ts",
      "packages/opencode/test/review.spec.ts",
    ]
    expect(relevant(matches)).toEqual(["test/cli/review.test.ts", "packages/opencode/test/review.spec.ts"])
  })

  test("handles windows separators", () => {
    expect(relevant(["node_modules\\pkg\\review.test.ts"])).toEqual([])
  })
})

describe("render", () => {
  test("reports covered and untested files with guidance", () => {
    const output = render([
      { file: "src/a.ts", tests: ["test/a.test.ts"] },
      { file: "src/b.ts", tests: [] },
    ])
    expect(output).toContain("1/2 files have tests.")
    expect(output).toContain("covered src/a.ts (1 test file)")
    expect(output).toContain("  test/a.test.ts")
    expect(output).toContain("untested src/b.ts")
    expect(output).toContain("Prefer changes in covered files.")
  })

  test("pluralizes test file counts", () => {
    const output = render([{ file: "src/a.ts", tests: ["test/a.test.ts", "test/a.spec.ts"] }])
    expect(output).toContain("covered src/a.ts (2 test files)")
  })
})
