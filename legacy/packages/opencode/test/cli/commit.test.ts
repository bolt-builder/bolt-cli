import { describe, expect, test } from "bun:test"
import { cap, clean } from "../../src/cli/cmd/commit"

describe("clean", () => {
  test("passes a plain message through", () => {
    expect(clean("feat(cli): add commit command")).toBe("feat(cli): add commit command")
  })

  test("strips think blocks", () => {
    expect(clean("<think>hmm\nlet me see</think>\nfix(core): handle empty diff")).toBe("fix(core): handle empty diff")
  })

  test("strips surrounding markdown fences", () => {
    expect(clean("```\nchore: bump deps\n```")).toBe("chore: bump deps")
    expect(clean("```text\nchore: bump deps\n```")).toBe("chore: bump deps")
  })

  test("keeps subject and body", () => {
    const message = "feat(tui): add fire border\n\nThe border burns while the agent works."
    expect(clean(message)).toBe(message)
  })

  test("returns empty string for empty input", () => {
    expect(clean("")).toBe("")
    expect(clean("<think>only thoughts</think>")).toBe("")
  })
})

describe("cap", () => {
  test("keeps short diffs intact", () => {
    expect(cap("small diff")).toBe("small diff")
  })

  test("truncates long diffs with a marker", () => {
    const result = cap("a".repeat(100), 10)
    expect(result).toBe(`${"a".repeat(10)}\n\n[diff truncated]`)
  })
})
