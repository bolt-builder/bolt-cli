import { describe, expect, test } from "bun:test"
import { ConfigEnv } from "../../src/config/env"

describe("variable", () => {
  test("maps snake_case keys", () => {
    expect(ConfigEnv.variable("small_model")).toBe("BOLT_SMALL_MODEL")
  })

  test("maps camelCase keys", () => {
    expect(ConfigEnv.variable("logLevel")).toBe("BOLT_LOG_LEVEL")
  })

  test("maps simple keys", () => {
    expect(ConfigEnv.variable("model")).toBe("BOLT_MODEL")
  })
})

describe("keys", () => {
  test("exposes every top-level config key except $schema", () => {
    const keys = ConfigEnv.keys()
    expect(keys).toContain("model")
    expect(keys).toContain("small_model")
    expect(keys).toContain("logLevel")
    expect(keys).not.toContain("$schema")
  })
})

describe("overrides", () => {
  test("maps string values", () => {
    const result = ConfigEnv.overrides({ BOLT_MODEL: "anthropic/claude-3-5-sonnet" })
    expect(result.config.model).toBe("anthropic/claude-3-5-sonnet")
    expect(result.warnings).toEqual([])
  })

  test("decodes JSON values that fit the schema", () => {
    const result = ConfigEnv.overrides({
      BOLT_SNAPSHOT: "false",
      BOLT_INSTRUCTIONS: '["EXTRA.md"]',
      BOLT_SUBAGENT_DEPTH: "2",
    })
    expect(result.config.snapshot).toBe(false)
    expect(result.config.instructions).toEqual(["EXTRA.md"])
    expect(result.config.subagent_depth).toBe(2)
  })

  test("keeps JSON-looking values as strings when the schema wants a string", () => {
    const result = ConfigEnv.overrides({ BOLT_USERNAME: "1234" })
    expect(result.config.username).toBe("1234")
  })

  test("warns on unknown vars that look like config keys", () => {
    const result = ConfigEnv.overrides({ BOLT_SMAL_MODEL: "anthropic/claude" })
    expect(result.config).toEqual({})
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain("BOLT_SMAL_MODEL")
    expect(result.warnings[0]).toContain("BOLT_SMALL_MODEL")
  })

  test("stays quiet on unknown vars that look nothing like config keys", () => {
    const result = ConfigEnv.overrides({ BOLT_DEPLOY_TARGET_REGION: "us-east-1" })
    expect(result.config).toEqual({})
    expect(result.warnings).toEqual([])
  })

  test("ignores reserved vars and non-BOLT vars", () => {
    const result = ConfigEnv.overrides({ BOLT_SQL_URL: "postgres://x", OPENCODE_MODEL: "a/b", PATH: "/usr/bin" })
    expect(result.config).toEqual({})
    expect(result.warnings).toEqual([])
  })

  test("rejects values that fail schema validation either way", () => {
    expect(() => ConfigEnv.overrides({ BOLT_SHARE: "always" })).toThrow()
  })
})
