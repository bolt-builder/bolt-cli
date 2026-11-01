import { describe, expect, test } from "bun:test"
import { extract, shape } from "../../src/tool/mcp-resource"

describe("shape", () => {
  test("reports when no resources exist", () => {
    expect(shape([])).toBe("No resources are available from connected MCP servers.")
  })

  test("renders server, uri, name, mimeType, and description", () => {
    const out = shape([
      {
        client: "docs",
        uri: "file:///readme.md",
        name: "readme",
        mimeType: "text/markdown",
        description: "Project readme",
      },
    ])
    expect(out).toBe(
      [
        "server: docs",
        "uri: file:///readme.md",
        "name: readme",
        "mimeType: text/markdown",
        "description: Project readme",
      ].join("\n"),
    )
  })

  test("omits absent optional fields", () => {
    const out = shape([{ client: "docs", uri: "file:///a", name: "a" }])
    expect(out).toBe(["server: docs", "uri: file:///a", "name: a"].join("\n"))
  })

  test("sorts by server then uri", () => {
    const out = shape([
      { client: "zeta", uri: "res://1", name: "z1" },
      { client: "alpha", uri: "res://2", name: "a2" },
      { client: "alpha", uri: "res://1", name: "a1" },
    ])
    const order = out.split("\n\n").map((block) => block.split("\n")[1])
    expect(order).toEqual(["uri: res://1", "uri: res://2", "uri: res://1"])
    expect(out.indexOf("alpha")).toBeLessThan(out.indexOf("zeta"))
  })
})

describe("extract", () => {
  test("returns text content", () => {
    const out = extract([{ uri: "res://a", mimeType: "text/plain", text: "hello" }], 100)
    expect(out).toEqual({ ok: true, output: "hello", truncated: false })
  })

  test("joins multiple text parts", () => {
    const out = extract(
      [
        { uri: "res://a", text: "one" },
        { uri: "res://b", text: "two" },
      ],
      100,
    )
    expect(out).toEqual({ ok: true, output: "one\n\ntwo", truncated: false })
  })

  test("caps oversized output", () => {
    const out = extract([{ uri: "res://a", text: "x".repeat(50) }], 10)
    expect(out).toEqual({ ok: true, output: "x".repeat(10), truncated: true })
  })

  test("output exactly at the cap is not truncated", () => {
    const out = extract([{ uri: "res://a", text: "x".repeat(10) }], 10)
    expect(out).toEqual({ ok: true, output: "x".repeat(10), truncated: false })
  })

  test("rejects blob-only content with the MIME type in the error", () => {
    const out = extract([{ uri: "res://img", mimeType: "image/png", blob: "aGk=" }], 100)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain("image/png")
  })

  test("rejects blob content without a MIME type", () => {
    const out = extract([{ uri: "res://bin", blob: "aGk=" }], 100)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain("unknown")
  })

  test("rejects empty contents", () => {
    const out = extract([], 100)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain("no text content")
  })

  test("prefers text parts when text and blob are mixed", () => {
    const out = extract(
      [
        { uri: "res://a", mimeType: "image/png", blob: "aGk=" },
        { uri: "res://b", text: "readable" },
      ],
      100,
    )
    expect(out).toEqual({ ok: true, output: "readable", truncated: false })
  })

  test("ignores non-string text values", () => {
    const out = extract([{ uri: "res://a", text: 42 }], 100)
    expect(out.ok).toBe(false)
  })
})
