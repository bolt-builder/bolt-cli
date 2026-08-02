import { describe, expect, test } from "bun:test"
import { verdict } from "../../src/cli/cmd/review"

describe("verdict", () => {
  test("parses a pass verdict", () => {
    expect(verdict("No issues found.\n\nVerdict: PASS")).toBe("pass")
  })

  test("parses a fail verdict", () => {
    expect(verdict("- critical: src/a.ts:12 leaks a handle\n\nVerdict: FAIL")).toBe("fail")
  })

  test("is case insensitive", () => {
    expect(verdict("verdict: pass")).toBe("pass")
    expect(verdict("VERDICT: Fail")).toBe("fail")
  })

  test("uses the last verdict when several appear", () => {
    expect(verdict('End with "Verdict: PASS" or "Verdict: FAIL".\n\nVerdict: FAIL')).toBe("fail")
  })

  test("returns undefined when no verdict is present", () => {
    expect(verdict("Looks fine to me.")).toBeUndefined()
  })
})
