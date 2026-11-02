import { describe, expect, test } from "bun:test"
import { parse } from "../src/tool/plugin/testrun"

describe("testrun.parse", () => {
  test("parses pytest failures with file and message", () => {
    const out = [
      "collected 3 items",
      "FAILED tests/test_auth.py::test_login - AssertionError: expected 200",
      "FAILED tests/test_auth.py::test_logout",
      "1 failed, 2 passed in 0.5s",
    ].join("\n")
    const result = parse(out)
    expect(result.failures).toEqual([
      { name: "test_login", file: "tests/test_auth.py", message: "AssertionError: expected 200" },
      { name: "test_logout", file: "tests/test_auth.py" },
    ])
    expect(result.counts).toEqual({ fail: 1, pass: 2 })
  })

  test("parses go test failures", () => {
    const out = ["--- FAIL: TestDispatch (0.03s)", "    dispatch_test.go:42: budget exceeded", "FAIL"].join("\n")
    expect(parse(out).failures).toEqual([{ name: "TestDispatch" }])
  })

  test("parses cargo test failures", () => {
    const out = ["test retry::tests::exhausts_budget ... FAILED", "test result: FAILED. 1 passed; 1 failed"].join("\n")
    expect(parse(out).failures).toEqual([{ name: "retry::tests::exhausts_budget" }])
  })

  test("parses bun test failures and counts", () => {
    const out = [
      "(pass) tool.edit > replaces text [1.2ms]",
      "(fail) tool.edit > preserves BOM",
      "1 pass",
      "1 fail",
    ].join("\n")
    const result = parse(out)
    expect(result.failures).toEqual([{ name: "tool.edit > preserves BOM" }])
    expect(result.counts).toEqual({ pass: 1, fail: 1 })
  })

  test("parses jest/vitest glyph failures and TAP", () => {
    const out = ["  ✕ renders the header (12 ms)", "not ok 2 - handles empty input"].join("\n")
    const names = parse(out).failures.map((failure) => failure.name)
    expect(names).toContain("renders the header")
    expect(names).toContain("handles empty input")
  })

  test("deduplicates repeated failures", () => {
    const out = ["--- FAIL: TestX", "--- FAIL: TestX"].join("\n")
    expect(parse(out).failures).toHaveLength(1)
  })

  test("returns empty for passing output", () => {
    const result = parse("all 12 tests passed\n12 pass\n0 fail")
    expect(result.failures).toEqual([])
    expect(result.counts.fail).toBe(0)
  })
})
