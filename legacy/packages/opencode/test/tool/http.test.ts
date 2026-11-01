import { describe, expect, test } from "bun:test"
import { interpolate, redact, resolve, summarize } from "../../src/tool/http"

describe("interpolate", () => {
  test("fills placeholders from the environment", () => {
    const out = interpolate("Bearer ${TOKEN}", { TOKEN: "abc123" })
    expect(out.value).toBe("Bearer abc123")
    expect(out.missing).toEqual([])
    expect(out.used).toEqual(["abc123"])
  })

  test("fills several placeholders in one template", () => {
    const out = interpolate("${USER}:${PASS}", { USER: "u", PASS: "p" })
    expect(out.value).toBe("u:p")
    expect(out.used).toEqual(["u", "p"])
  })

  test("reports missing variables", () => {
    const out = interpolate("Bearer ${TOKEN}", {})
    expect(out.missing).toEqual(["TOKEN"])
    expect(out.used).toEqual([])
  })

  test("leaves plain values untouched", () => {
    const out = interpolate("application/json", { TOKEN: "abc" })
    expect(out.value).toBe("application/json")
    expect(out.missing).toEqual([])
    expect(out.used).toEqual([])
  })

  test("ignores malformed placeholders", () => {
    expect(interpolate("$TOKEN and ${1BAD}", { TOKEN: "x" }).value).toBe("$TOKEN and ${1BAD}")
  })
})

describe("resolve", () => {
  const profiles = {
    github: { headers: { Authorization: "Bearer ${GITHUB_TOKEN}", Accept: "application/vnd.github+json" } },
    plain: {},
  }

  test("resolves a profile and collects injected secrets", () => {
    const out = resolve(profiles, "github", { GITHUB_TOKEN: "ghp_secret" })
    expect(out).toEqual({
      ok: true,
      headers: { Authorization: "Bearer ghp_secret", Accept: "application/vnd.github+json" },
      secrets: ["ghp_secret"],
    })
  })

  test("accepts a profile without headers", () => {
    expect(resolve(profiles, "plain", {})).toEqual({ ok: true, headers: {}, secrets: [] })
  })

  test("fails on an unknown profile and lists the available ones", () => {
    const out = resolve(profiles, "gitlab", {})
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain("github, plain")
  })

  test("fails when a referenced environment variable is not set", () => {
    const out = resolve(profiles, "github", {})
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain("GITHUB_TOKEN")
  })

  test("fails on malformed profile files", () => {
    expect(resolve([], "github", {}).ok).toBe(false)
    expect(resolve("nope", "github", {}).ok).toBe(false)
    expect(resolve({ github: "nope" }, "github", {}).ok).toBe(false)
    expect(resolve({ github: { headers: { Authorization: 5 } } }, "github", {}).ok).toBe(false)
  })
})

describe("redact", () => {
  test("scrubs secret values wherever they appear", () => {
    expect(redact("token ghp_secret leaked into ghp_secret twice", ["ghp_secret"])).toBe(
      "token [redacted] leaked into [redacted] twice",
    )
  })

  test("skips values too short to redact safely", () => {
    expect(redact("a 1 b", ["1"])).toBe("a 1 b")
  })

  test("handles several secrets", () => {
    expect(redact("user alpha pass beta1", ["alpha", "beta1"])).toBe("user [redacted] pass [redacted]")
  })
})

describe("summarize", () => {
  test("describes top-level keys and types", () => {
    expect(summarize({ id: 1, name: "x", tags: ["a", "b"], meta: { deep: true }, gone: null })).toBe(
      ["id: number", "name: string", "tags: array(2) of string", "meta: object", "gone: null"].join("\n"),
    )
  })

  test("describes top-level arrays", () => {
    expect(summarize([{ id: 1 }, { id: 2 }])).toBe("array(2) of object")
    expect(summarize([])).toBe("array(0)")
  })

  test("describes scalars", () => {
    expect(summarize("hi")).toBe("string")
    expect(summarize(42)).toBe("number")
    expect(summarize(null)).toBe("null")
  })

  test("describes empty objects", () => {
    expect(summarize({})).toBe("object (empty)")
  })
})
