import { describe, expect, test } from "bun:test"
import { changes, cover, groups } from "../../src/cli/cmd/split"

describe("changes", () => {
  test("parses modified, staged, and untracked files", () => {
    const text = [" M src/a.ts", "M  src/b.ts", "?? notes.md", "D  src/c.ts"].join("\n")
    expect(changes(text).map((change) => change.file)).toEqual(["src/a.ts", "src/b.ts", "notes.md", "src/c.ts"])
  })

  test("uses the new path for renames", () => {
    const found = changes("R  src/old.ts -> src/new.ts")
    expect(found).toHaveLength(1)
    expect(found[0].file).toBe("src/new.ts")
  })

  test("skips unmerged entries", () => {
    expect(changes("UU src/conflict.ts\n M src/a.ts").map((change) => change.file)).toEqual(["src/a.ts"])
  })

  test("returns nothing for a clean status", () => {
    expect(changes("")).toEqual([])
  })
})

const RESPONSE = [
  "Two logical changes here.",
  "",
  "```",
  "commit: feat(bolt): add retry budget",
  "- src/retry.ts",
  "- src/config.ts",
  "commit: docs: document the retry budget",
  "- README2.md",
  "```",
].join("\n")

describe("groups", () => {
  test("parses ordered groups with messages and files", () => {
    const plan = groups(RESPONSE)
    expect(plan).toHaveLength(2)
    expect(plan?.[0].message).toBe("feat(bolt): add retry budget")
    expect(plan?.[0].files).toEqual(["src/retry.ts", "src/config.ts"])
    expect(plan?.[1].files).toEqual(["README2.md"])
  })

  test("rejects a group without files", () => {
    expect(groups("```\ncommit: feat: empty\n```")).toBeUndefined()
  })

  test("rejects files before any group", () => {
    expect(groups("```\n- src/a.ts\ncommit: feat: late\n```")).toBeUndefined()
  })

  test("rejects unparseable lines", () => {
    expect(groups("```\ncommit: feat: ok\n- src/a.ts\nrandom prose\n```")).toBeUndefined()
  })

  test("rejects a response without a fenced block", () => {
    expect(groups("commit: feat: ok\n- src/a.ts")).toBeUndefined()
  })
})

describe("cover", () => {
  const files = ["src/a.ts", "src/b.ts"]

  test("accepts a complete plan", () => {
    expect(cover([{ message: "feat: both", files: ["src/a.ts", "src/b.ts"] }], files)).toBeUndefined()
  })

  test("flags missing files", () => {
    expect(cover([{ message: "feat: one", files: ["src/a.ts"] }], files)).toContain("missing")
  })

  test("flags unknown files", () => {
    expect(cover([{ message: "feat: all", files: ["src/a.ts", "src/b.ts", "src/c.ts"] }], files)).toContain("unknown")
  })

  test("flags duplicated files", () => {
    const plan = [
      { message: "feat: one", files: ["src/a.ts"] },
      { message: "feat: two", files: ["src/a.ts", "src/b.ts"] },
    ]
    expect(cover(plan, files)).toContain("more than once")
  })
})
