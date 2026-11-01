import { describe, expect, test } from "bun:test"
import { convention, lint, subject } from "../../src/cli/cmd/commitlint"

describe("subject", () => {
  test("parses type, scope, and summary", () => {
    expect(subject("feat(bolt): add retry budget")).toEqual({
      type: "feat",
      scope: "bolt",
      summary: "add retry budget",
    })
  })

  test("parses a type without a scope", () => {
    expect(subject("docs: update contributing guide")).toEqual({ type: "docs", summary: "update contributing guide" })
  })

  test("parses breaking-change markers", () => {
    expect(subject("feat(core)!: drop legacy sessions").type).toBe("feat")
  })

  test("treats freeform subjects as summary only", () => {
    expect(subject("Update readme")).toEqual({ summary: "Update readme" })
  })
})

const HISTORY = [
  ...Array.from({ length: 12 }, (_, i) => `feat(bolt): add feature ${i}`),
  ...Array.from({ length: 8 }, (_, i) => `fix(core): fix bug ${i}`),
  ...Array.from({ length: 4 }, (_, i) => `chore: cleanup ${i}`),
]

describe("convention", () => {
  test("learns the conventional style, types, and scopes", () => {
    const rules = convention(HISTORY)
    expect(rules.conventional).toBe(true)
    expect(rules.types).toEqual(["chore", "feat", "fix"])
    expect(rules.scopes).toEqual(["bolt", "core"])
    expect(rules.period).toBe(false)
    expect(rules.lower).toBe(true)
  })

  test("detects freeform repos", () => {
    const rules = convention(Array.from({ length: 20 }, (_, i) => `Update module ${i}`))
    expect(rules.conventional).toBe(false)
  })

  test("keeps a sane length floor", () => {
    expect(convention(HISTORY).length).toBeGreaterThanOrEqual(50)
  })
})

describe("lint", () => {
  const rules = convention(HISTORY)

  test("passes a conforming subject", () => {
    expect(lint("feat(bolt): add worktree manager", rules)).toEqual([])
  })

  test("flags a freeform subject in a conventional repo", () => {
    expect(lint("added some stuff", rules).join(" ")).toContain("type(scope): summary")
  })

  test("flags an unknown type", () => {
    expect(lint("perf(bolt): speed up startup", rules).join(" ")).toContain('type "perf"')
  })

  test("flags an unknown scope", () => {
    expect(lint("feat(tui): add spinner", rules).join(" ")).toContain('scope "tui"')
  })

  test("flags an overlong subject", () => {
    const long = `feat(bolt): ${"x".repeat(200)}`
    expect(lint(long, rules).join(" ")).toContain("characters")
  })

  test("flags a trailing period when history avoids them", () => {
    expect(lint("feat(bolt): add thing.", rules).join(" ")).toContain("period")
  })

  test("flags an uppercase summary when history is lowercase", () => {
    expect(lint("feat(bolt): Add thing", rules).join(" ")).toContain("uppercase")
  })

  test("does not flag scopes in a repo without established scopes", () => {
    const loose = convention(Array.from({ length: 20 }, (_, i) => `feat: change ${i}`))
    expect(lint("feat(anything): change", loose)).toEqual([])
  })
})
