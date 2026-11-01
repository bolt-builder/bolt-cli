import { describe, expect, test } from "bun:test"
import { banner, codePrompt, decide, defects, feedback, planPrompt, reviewPrompt } from "../../src/cli/cmd/pipeline"

describe("decide", () => {
  test("passes on a pass verdict regardless of attempts left", () => {
    expect(decide("pass", 1, 2)).toBe("pass")
    expect(decide("pass", 2, 2)).toBe("pass")
  })

  test("retries a failed attempt when attempts remain", () => {
    expect(decide("fail", 1, 2)).toBe("retry")
  })

  test("stops a failed attempt at the attempt cap", () => {
    expect(decide("fail", 2, 2)).toBe("stop")
    expect(decide("fail", 3, 2)).toBe("stop")
  })

  test("treats a missing verdict as a failure", () => {
    expect(decide(undefined, 1, 2)).toBe("retry")
    expect(decide(undefined, 2, 2)).toBe("stop")
  })

  test("stops immediately when only one attempt is allowed", () => {
    expect(decide("fail", 1, 1)).toBe("stop")
  })
})

describe("defects", () => {
  test("extracts bullet and numbered defects", () => {
    const review = ["Some preamble.", "- src/a.ts:12 leaks a handle", "1. src/b.ts:3 misses the early return", ""].join(
      "\n",
    )
    expect(defects(review)).toEqual(["- src/a.ts:12 leaks a handle", "1. src/b.ts:3 misses the early return"])
  })

  test("drops list items that carry the verdict marker", () => {
    expect(defects("- src/a.ts:1 broken\n- Verdict: FAIL")).toEqual(["- src/a.ts:1 broken"])
  })

  test("returns an empty list when the review has no list items", () => {
    expect(defects("Looks wrong overall.\n\nVerdict: FAIL")).toEqual([])
  })
})

describe("feedback", () => {
  test("prefers the defect list", () => {
    expect(feedback("Preamble.\n- src/a.ts:1 broken\n\nVerdict: FAIL")).toBe("- src/a.ts:1 broken")
  })

  test("falls back to the review body without the verdict line", () => {
    expect(feedback("The change misses the config path.\n\nVerdict: FAIL")).toBe("The change misses the config path.")
  })
})

describe("banner", () => {
  test("omits the attempt counter for single-attempt stages", () => {
    expect(banner("plan", 1, 1)).toBe("── plan ──")
  })

  test("includes the attempt counter when retries are possible", () => {
    expect(banner("code", 2, 3)).toBe("── code (attempt 2/3) ──")
  })
})

describe("prompts", () => {
  test("plan prompt carries the task", () => {
    expect(planPrompt("add a --json flag")).toContain("Task: add a --json flag")
  })

  test("code prompt carries the plan verbatim and appends defects on retry", () => {
    const first = codePrompt("task", "1. edit a.ts\n2. edit b.ts")
    expect(first).toContain("1. edit a.ts\n2. edit b.ts")
    expect(first).not.toContain("reviewer found these defects")
    const retry = codePrompt("task", "1. edit a.ts", "- a.ts:1 broken")
    expect(retry).toContain("reviewer found these defects")
    expect(retry).toContain("- a.ts:1 broken")
  })

  test("review prompt carries the task, plan, diff, and verdict contract", () => {
    const text = reviewPrompt("task", "1. edit a.ts", "diff --git a/a.ts b/a.ts")
    expect(text).toContain("Task: task")
    expect(text).toContain("1. edit a.ts")
    expect(text).toContain("diff --git a/a.ts b/a.ts")
    expect(text).toContain('"Verdict: PASS"')
    expect(text).toContain('"Verdict: FAIL"')
  })
})
