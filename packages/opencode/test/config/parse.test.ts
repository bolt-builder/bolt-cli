import { describe, expect, test } from "bun:test"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { ConfigParse } from "../../src/config/parse"

type Issue = { code?: string; keys?: string[]; path?: string[]; message: string }

function issues(data: unknown): Issue[] {
  try {
    ConfigParse.schema(ConfigV1.Info, data, "test")
    return []
  } catch (err) {
    const error = err as { data?: { issues?: Issue[] } }
    return error.data?.issues ?? []
  }
}

describe("config key suggestions", () => {
  test("suggests the closest key for a top-level typo", () => {
    const found = issues({ instrcutions: ["AGENTS.md"] })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ code: "unrecognized_keys", keys: ["instrcutions"], path: [] })
    expect(found[0].message).toBe('Unrecognized key: instrcutions (did you mean "instructions"?)')
  })

  test("omits the suggestion when nothing is close", () => {
    const found = issues({ zzzzzzzzzz: true })
    expect(found).toHaveLength(1)
    expect(found[0].message).toBe("Unrecognized key: zzzzzzzzzz")
  })

  test("reports one issue per unknown key", () => {
    const found = issues({ modle: "anthropic/claude", smal_model: "anthropic/haiku" })
    expect(found).toHaveLength(2)
    expect(found.map((issue) => issue.keys)).toEqual([["modle"], ["smal_model"]])
    expect(found[1].message).toContain('did you mean "small_model"?')
  })

  test("flags typos inside nested closed structs with their path", () => {
    const found = issues({ compaction: { autoo: true } })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ code: "unrecognized_keys", keys: ["autoo"], path: ["compaction"] })
    expect(found[0].message).toBe('Unrecognized key in "compaction": autoo (did you mean "auto"?)')
  })

  test("flags typos inside experimental", () => {
    const found = issues({ experimental: { batch_tool: true, bach_tool: true } })
    expect(found).toHaveLength(1)
    expect(found[0].path).toEqual(["experimental"])
    expect(found[0].message).toContain('did you mean "batch_tool"?')
  })

  test("keeps arbitrary keys in open shapes like permission and agent", () => {
    const config = ConfigParse.schema(
      ConfigV1.Info,
      {
        permission: { "tools_*": "allow", bash: "ask" },
        agent: { reviewer: { description: "reviews code" } },
      },
      "test",
    )
    expect(Object.keys(config.permission!)).toEqual(["tools_*", "bash"])
    expect(config.agent?.reviewer).toBeDefined()
  })

  test("accepts a fully valid config", () => {
    const config = ConfigParse.schema(
      ConfigV1.Info,
      { model: "anthropic/claude", compaction: { auto: false }, experimental: { batch_tool: true } },
      "test",
    )
    expect(config.model).toBe("anthropic/claude")
  })
})
