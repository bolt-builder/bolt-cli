import { describe, expect, test } from "bun:test"
import type { Provider } from "@/provider/provider"
import { SessionDistill } from "@/session/distill"

function createModel(context: number): Provider.Model {
  return {
    id: "test-model",
    providerID: "test",
    name: "Test",
    limit: { context, output: 8_000 },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      input: { text: true, image: false, audio: false, video: false },
      output: { text: true, image: false, audio: false, video: false },
    },
    api: { npm: "@ai-sdk/anthropic" },
    options: {},
  } as Provider.Model
}

describe("session.distill.small", () => {
  test("detects small context windows", () => {
    expect(SessionDistill.small(createModel(32_000))).toBe(true)
    expect(SessionDistill.small(createModel(SessionDistill.SMALL_CONTEXT))).toBe(false)
    expect(SessionDistill.small(createModel(200_000))).toBe(false)
  })

  test("treats unknown context as not small", () => {
    expect(SessionDistill.small(createModel(0))).toBe(false)
  })
})

describe("session.distill.select", () => {
  test("keeps every section when within budget", () => {
    const sections = SessionDistill.select({
      context: 32_000,
      required: ["env"],
      optional: ["mcp", "skills"],
    })
    expect(sections).toEqual(["env", "mcp", "skills"])
  })

  test("always keeps required sections even over budget", () => {
    // 32k context, ratio 0.25 -> 8k token budget -> 32k chars
    const huge = "x".repeat(40_000)
    const sections = SessionDistill.select({
      context: 32_000,
      required: [huge],
      optional: ["mcp"],
    })
    expect(sections[0]).toBe(huge)
  })

  test("drops optional sections that blow the budget", () => {
    const huge = "x".repeat(40_000)
    const sections = SessionDistill.select({
      context: 32_000,
      required: ["env"],
      optional: [huge, "skills"],
    })
    expect(sections).toEqual(["env", "skills"])
  })

  test("skips oversized sections but keeps later ones that fit", () => {
    const filler = "x".repeat(28_000)
    const big = "y".repeat(10_000)
    const sections = SessionDistill.select({
      context: 32_000,
      required: [filler],
      optional: [big, "memory"],
    })
    expect(sections).toEqual([filler, "memory"])
  })
})

describe("session.distill.options", () => {
  test("caps tool output for small models only", () => {
    expect(SessionDistill.options(createModel(32_000))).toEqual({
      toolOutputMaxChars: SessionDistill.TOOL_OUTPUT_MAX_CHARS,
    })
    expect(SessionDistill.options(createModel(200_000))).toBeUndefined()
  })
})
