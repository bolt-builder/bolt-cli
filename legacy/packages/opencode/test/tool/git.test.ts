import { describe, expect, test } from "bun:test"
import { parseBlame, parseLog, parsePatch, parseStatus } from "../../src/tool/git"

describe("git.parseStatus", () => {
  test("parses changed, staged, and untracked entries", () => {
    const out = [
      "1 M. N... 100644 100644 100644 abc def src/staged.ts",
      "1 .M N... 100644 100644 100644 abc def src/dirty.ts",
      "1 MM N... 100644 100644 100644 abc def src/both.ts",
      "? notes.md",
    ].join("\0")
    const result = parseStatus(out)
    expect(result.staged).toEqual([
      { path: "src/staged.ts", status: "modified" },
      { path: "src/both.ts", status: "modified" },
    ])
    expect(result.unstaged).toEqual([
      { path: "src/dirty.ts", status: "modified" },
      { path: "src/both.ts", status: "modified" },
    ])
    expect(result.untracked).toEqual(["notes.md"])
  })

  test("detects renames with the original path", () => {
    const out = ["2 R. N... 100644 100644 100644 abc def R100 src/new.ts", "src/old.ts"].join("\0")
    const result = parseStatus(out)
    expect(result.staged).toEqual([{ path: "src/new.ts", status: "renamed", from: "src/old.ts" }])
    expect(result.unstaged).toEqual([])
  })

  test("handles paths containing spaces", () => {
    const out = "1 A. N... 000000 100644 100644 abc def docs/release notes.md"
    expect(parseStatus(out).staged).toEqual([{ path: "docs/release notes.md", status: "added" }])
  })

  test("marks unmerged entries as conflicted", () => {
    const out = "u UU N... 100644 100644 100644 100644 a b c src/conflict.ts"
    expect(parseStatus(out).unstaged).toEqual([{ path: "src/conflict.ts", status: "conflicted" }])
  })

  test("returns empty buckets for a clean tree", () => {
    expect(parseStatus("")).toEqual({ staged: [], unstaged: [], untracked: [] })
  })
})

describe("git.parsePatch", () => {
  test("summarizes per-file hunks, additions, and deletions", () => {
    const patch = [
      "diff --git a/src/a.ts b/src/a.ts",
      "index abc..def 100644",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,3 +1,4 @@",
      " context",
      "+added one",
      "+added two",
      "-removed",
      "@@ -10,2 +11,2 @@",
      "-old",
      "+new",
      "diff --git a/src/b.ts b/src/b.ts",
      "--- a/src/b.ts",
      "+++ b/src/b.ts",
      "@@ -1 +1 @@",
      "-x",
      "+y",
    ].join("\n")
    expect(parsePatch(patch)).toEqual([
      { file: "src/a.ts", hunks: 2, additions: 3, deletions: 2 },
      { file: "src/b.ts", hunks: 1, additions: 1, deletions: 1 },
    ])
  })

  test("returns no files for empty output", () => {
    expect(parsePatch("")).toEqual([])
  })
})

describe("git.parseLog", () => {
  test("parses records into sha, author, date, and subject", () => {
    const out = [
      "a".repeat(40) + "\x1fAlice\x1f2026-01-02T03:04:05+00:00\x1ffeat(bolt): add thing\x1e",
      "\n" + "b".repeat(40) + "\x1fBob\x1f2026-01-01T00:00:00+00:00\x1ffix: subject with \x1e",
    ].join("")
    const entries = parseLog(out)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      sha: "a".repeat(40),
      author: "Alice",
      date: "2026-01-02T03:04:05+00:00",
      subject: "feat(bolt): add thing",
    })
    expect(entries[1].author).toBe("Bob")
  })

  test("returns no entries for empty output", () => {
    expect(parseLog("")).toEqual([])
  })
})

describe("git.parseBlame", () => {
  test("attributes lines and reuses cached commit headers", () => {
    const sha1 = "1".repeat(40)
    const sha2 = "2".repeat(40)
    const out = [
      `${sha1} 1 1 2`,
      "author Alice",
      "author-mail <alice@example.com>",
      "summary first commit",
      "\tconst a = 1",
      `${sha1} 2 2`,
      "\tconst b = 2",
      `${sha2} 3 3 1`,
      "author Bob",
      "summary second commit",
      "\tconst c = 3",
    ].join("\n")
    expect(parseBlame(out)).toEqual([
      { line: 1, sha: sha1, author: "Alice", content: "const a = 1" },
      { line: 2, sha: sha1, author: "Alice", content: "const b = 2" },
      { line: 3, sha: sha2, author: "Bob", content: "const c = 3" },
    ])
  })

  test("returns no lines for empty output", () => {
    expect(parseBlame("")).toEqual([])
  })
})
