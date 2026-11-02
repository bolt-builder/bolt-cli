import { describe, expect, test } from "bun:test"
import { enabled, describeWrite, describeCommand } from "@/dryrun"

describe("enabled", () => {
  test("only an explicit true marker enables dry-run", () => {
    expect(enabled({ dryrun: true })).toBe(true)
    expect(enabled({ dryrun: false })).toBe(false)
    expect(enabled({ dryrun: "true" })).toBe(false)
    expect(enabled({ sandbox: true })).toBe(false)
    expect(enabled({})).toBe(false)
    expect(enabled(undefined)).toBe(false)
    expect(enabled(null)).toBe(false)
  })
})

describe("describeWrite", () => {
  test("reports the file and the diff", () => {
    const out = describeWrite("src/index.ts", "@@ -1 +1 @@\n-a\n+b")
    expect(out).toContain("DRY RUN: no changes were made.")
    expect(out).toContain("Would modify src/index.ts:")
    expect(out).toContain("-a")
    expect(out).toContain("+b")
  })

  test("handles empty diffs", () => {
    expect(describeWrite("a.txt", "")).toContain("(no content changes)")
  })
})

describe("describeCommand", () => {
  test("reports the command and cwd without running it", () => {
    const out = describeCommand("rm -rf dist", "/repo")
    expect(out).toContain("DRY RUN: command not executed.")
    expect(out).toContain("Would run in /repo:")
    expect(out).toContain("rm -rf dist")
  })
})
