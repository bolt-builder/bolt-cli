import { describe, expect, test } from "bun:test"
import { SessionHunk } from "@/session/hunk"

const patch = [
  "diff --git a/src/foo.ts b/src/foo.ts",
  "index 1111111..2222222 100644",
  "--- a/src/foo.ts",
  "+++ b/src/foo.ts",
  "@@ -1,3 +1,4 @@",
  " const a = 1",
  "+const b = 2",
  " const c = 3",
  " const d = 4",
  "@@ -10,2 +11,2 @@",
  "-const old = true",
  "+const old = false",
  " const keep = 1",
].join("\n")

describe("session.hunk.parse", () => {
  test("splits a unified diff into hunks and drops file headers", () => {
    const hunks = SessionHunk.parse(patch)
    expect(hunks).toHaveLength(2)
    expect(hunks[0].header).toBe("@@ -1,3 +1,4 @@")
    expect(hunks[0].lines).toEqual([" const a = 1", "+const b = 2", " const c = 3", " const d = 4"])
    expect(hunks[1].header).toBe("@@ -10,2 +11,2 @@")
  })

  test("returns nothing for an empty diff", () => {
    expect(SessionHunk.parse("")).toEqual([])
  })
})

describe("session.hunk.select", () => {
  test("keeps every hunk within budget", () => {
    const hunks = SessionHunk.parse(patch)
    expect(SessionHunk.select({ hunks, budget: 10_000 })).toHaveLength(2)
  })

  test("drops oversized hunks but keeps later ones that fit", () => {
    const big = { header: "@@ -1,50 +1,50 @@", lines: ["+".padEnd(500, "x")] }
    const rest = { header: "@@ -60,1 +60,1 @@", lines: ["+ok"] }
    const kept = SessionHunk.select({ hunks: [big, rest], budget: 100 })
    expect(kept).toHaveLength(1)
    expect(kept[0].header).toBe("@@ -60,1 +60,1 @@")
  })

  test("returns nothing when the budget fits no hunk", () => {
    expect(SessionHunk.select({ hunks: SessionHunk.parse(patch), budget: 1 })).toEqual([])
  })
})

describe("session.hunk.render", () => {
  test("renders kept hunks with their headers", () => {
    const hunks = SessionHunk.parse(patch)
    const output = SessionHunk.render({ file: "src/foo.ts", hunks, total: hunks.length })
    expect(output).toContain("Changed hunks in src/foo.ts")
    expect(output).toContain("@@ -1,3 +1,4 @@")
    expect(output).toContain("+const b = 2")
    expect(output).not.toContain("omitted")
  })

  test("notes dropped hunks", () => {
    const hunks = SessionHunk.parse(patch)
    const output = SessionHunk.render({ file: "src/foo.ts", hunks: hunks.slice(0, 1), total: 2 })
    expect(output).toContain("[1 more hunk omitted]")
  })
})
