import { describe, expect, test } from "bun:test"
import { edit, segments, select, value } from "../../src/cli/cmd/config/edit"

describe("segments", () => {
  test("splits dot paths and converts numeric parts to indices", () => {
    expect(segments("provider.anthropic.options.baseURL")).toEqual(["provider", "anthropic", "options", "baseURL"])
    expect(segments("instructions.0")).toEqual(["instructions", 0])
    expect(segments("model")).toEqual(["model"])
  })
})

describe("value", () => {
  test("decodes JSON values", () => {
    expect(value("false")).toBe(false)
    expect(value("42")).toBe(42)
    expect(value('["A.md"]')).toEqual(["A.md"])
    expect(value('{"auto":true}')).toEqual({ auto: true })
  })

  test("keeps non-JSON input as a raw string", () => {
    expect(value("anthropic/claude-sonnet-4-5")).toBe("anthropic/claude-sonnet-4-5")
    expect(value("DEBUG")).toBe("DEBUG")
  })
})

describe("edit", () => {
  test("sets a top-level key in an empty object", () => {
    expect(JSON.parse(edit("{}", "model", "a/b"))).toEqual({ model: "a/b" })
  })

  test("creates nested objects along the path", () => {
    const updated = edit("{}", "provider.anthropic.options.baseURL", "https://gw.example.com")
    expect(JSON.parse(updated)).toEqual({
      provider: { anthropic: { options: { baseURL: "https://gw.example.com" } } },
    })
  })

  test("preserves comments when updating a jsonc file", () => {
    const text = ['{', '  // the model to use', '  "model": "old/model",', '  "snapshot": true', '}'].join("\n")
    const updated = edit(text, "model", "new/model")
    expect(updated).toContain("// the model to use")
    expect(updated).toContain('"model": "new/model"')
    expect(updated).toContain('"snapshot": true')
  })

  test("preserves comments when removing a key", () => {
    const text = ['{', '  // keep me', '  "snapshot": true,', '  "model": "old/model"', '}'].join("\n")
    const updated = edit(text, "model", undefined)
    expect(updated).toContain("// keep me")
    expect(updated).not.toContain("model")
    expect(updated).toContain('"snapshot": true')
  })

  test("updates array elements by index", () => {
    const updated = edit('{"instructions":["A.md","B.md"]}', "instructions.1", "C.md")
    expect(JSON.parse(updated)).toEqual({ instructions: ["A.md", "C.md"] })
  })
})

describe("select", () => {
  const config = { model: "a/b", provider: { anthropic: { options: { baseURL: "x" } } }, instructions: ["A.md"] }

  test("walks objects and arrays", () => {
    expect(select(config, "model")).toBe("a/b")
    expect(select(config, "provider.anthropic.options.baseURL")).toBe("x")
    expect(select(config, "instructions.0")).toBe("A.md")
  })

  test("returns undefined for missing paths", () => {
    expect(select(config, "missing")).toBeUndefined()
    expect(select(config, "provider.openai.options")).toBeUndefined()
    expect(select(config, "model.nested")).toBeUndefined()
  })
})
