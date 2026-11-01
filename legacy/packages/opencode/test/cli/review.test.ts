import { describe, expect, test } from "bun:test"
import { confidence, verdict } from "../../src/cli/cmd/review"

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

describe("confidence", () => {
  test("parses a high confidence", () => {
    expect(confidence("Renamed the helper everywhere.\n\nConfidence: high")).toBe("high")
  })

  test("parses a medium confidence", () => {
    expect(confidence("Confidence: medium")).toBe("medium")
  })

  test("parses a low confidence", () => {
    expect(confidence("I could not verify the callers.\n\nConfidence: low")).toBe("low")
  })

  test("is case insensitive", () => {
    expect(confidence("CONFIDENCE: High")).toBe("high")
    expect(confidence("confidence: LOW")).toBe("low")
  })

  test("uses the last confidence when several appear", () => {
    expect(confidence('End with "Confidence: high" or "Confidence: low".\n\nConfidence: medium')).toBe("medium")
  })

  test("returns undefined when no confidence is present", () => {
    expect(confidence("Looks fine to me.")).toBeUndefined()
  })
})
