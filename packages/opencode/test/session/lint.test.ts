import { describe, expect, test } from "bun:test"
import { SessionLint } from "@/session/lint"

describe("session.lint", () => {
  test("flags directives with opposite polarity on the same subject", () => {
    const warnings = SessionLint.lint([
      "Always use tabs for indentation in source files.",
      "Never use tabs for indentation, spaces only.",
    ])
    expect(warnings).toHaveLength(1)
    expect(warnings[0].first).toContain("Always use tabs")
    expect(warnings[0].second).toContain("Never use tabs")
    expect(warnings[0].subject).toContain("tabs")
  })

  test("flags conflicts across different sections", () => {
    const warnings = SessionLint.lint([
      "Instructions from AGENTS.md:\n- Prefer named exports for React components.",
      "Instructions from CLAUDE.md:\n- Avoid named exports for React components, use default exports.",
    ])
    expect(warnings).toHaveLength(1)
  })

  test("ignores directives about different subjects", () => {
    const warnings = SessionLint.lint([
      "Always run the formatter before committing.",
      "Never commit secrets or credentials to the repository.",
    ])
    expect(warnings).toEqual([])
  })

  test("ignores agreeing directives", () => {
    const warnings = SessionLint.lint([
      "Never use var declarations in TypeScript code.",
      "Avoid var declarations in TypeScript code.",
    ])
    expect(warnings).toEqual([])
  })

  test("ignores non-directive prose", () => {
    const warnings = SessionLint.lint([
      "The project is a monorepo with several packages.",
      "Tests live under the test directory.",
    ])
    expect(warnings).toEqual([])
  })

  test("skips directives with too little subject", () => {
    expect(SessionLint.lint(["Always focus.", "Never focus."])).toEqual([])
  })
})
