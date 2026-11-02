import { describe, expect, test } from "bun:test"
import PROMPT_BUG from "@/command/template/bug.txt"
import { Command } from "@/command"

describe("bug command", () => {
  test("is a registered default", () => {
    expect(Command.Default.BUG).toBe("bug")
  })

  test("template takes the description as $ARGUMENTS", () => {
    expect(Command.hints(PROMPT_BUG)).toEqual(["$ARGUMENTS"])
  })

  test("template carries the report contract", () => {
    for (const section of ["Description", "Steps to reproduce", "Expected behavior", "Actual behavior", "Environment"])
      expect(PROMPT_BUG).toContain(section)
    expect(PROMPT_BUG).toContain("gh issue create --repo bolt-builder/bolt-cli")
    expect(PROMPT_BUG).toContain("https://github.com/bolt-builder/bolt-cli/issues/new")
    expect(PROMPT_BUG).toContain("Never include API keys")
  })
})
