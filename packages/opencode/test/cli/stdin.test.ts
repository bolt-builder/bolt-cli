import { describe, expect, test } from "bun:test"
import { Stdin } from "../../src/cli/stdin"

describe("normalize", () => {
  test("returns undefined for empty input", () => {
    expect(Stdin.normalize("")).toBeUndefined()
  })

  test("returns undefined for whitespace-only input", () => {
    expect(Stdin.normalize(" \n\t\n")).toBeUndefined()
  })

  test("preserves meaningful input verbatim", () => {
    expect(Stdin.normalize("diff --git a/x b/x\n")).toBe("diff --git a/x b/x\n")
  })
})
