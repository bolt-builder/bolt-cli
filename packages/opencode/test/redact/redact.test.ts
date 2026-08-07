import { describe, expect, test } from "bun:test"
import { Redact } from "@opencode-ai/core/redact"

describe("Redact.text", () => {
  test("redacts well-known token formats", () => {
    expect(Redact.text("key AKIAIOSFODNN7EXAMPLE end")).toBe("key [redacted:aws-key] end")
    expect(Redact.text("ghp_abcdefghijklmnopqrstuvwxyz012345")).toBe("[redacted:github-token]")
    expect(Redact.text("github_pat_11ABCDEFG0123456789abcdefghij")).toBe("[redacted:github-token]")
    expect(Redact.text("sk-ant-api03-abcdefghijklmnopqrstuv")).toBe("[redacted:api-key]")
    expect(Redact.text("token xoxb-1234567890-abcdefghij")).toBe("token [redacted:slack-token]")
    expect(Redact.text("sk_live_abcdefghijklmnop123")).toBe("[redacted:stripe-key]")
    expect(Redact.text("AIzaSyA1234567890abcdefghijklmnopqrstuv")).toBe("[redacted:google-key]")
    expect(Redact.text("npm_abcdefghijklmnopqrstuvwxyz0123456789")).toBe("[redacted:npm-token]")
    expect(Redact.text("Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456")).toBe(
      "Authorization: [redacted:bearer]",
    )
  })

  test("redacts jwts and private key blocks", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdef-_123"
    expect(Redact.text(`jwt=${jwt}`)).toBe("jwt=[redacted:jwt]")
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIEow...\n-----END RSA PRIVATE KEY-----"
    expect(Redact.text(`cat key.pem\n${pem}`)).toBe("cat key.pem\n[redacted:private-key]")
  })

  test("leaves ordinary code and prose untouched", () => {
    const code = 'const skill = "sk-illful"; // not a key\nconst env = process.env.GITHUB_TOKEN'
    expect(Redact.text(code)).toBe(code)
    expect(Redact.text("short")).toBe("short")
    expect(Redact.text("git push origin main")).toBe("git push origin main")
  })
})

describe("Redact.deep", () => {
  test("walks arrays and plain objects", () => {
    const input = {
      role: "user",
      content: [{ type: "text", text: "my key is ghp_abcdefghijklmnopqrstuvwxyz012345" }],
    }
    const out = Redact.deep(input)
    expect(out.content[0].text).toBe("my key is [redacted:github-token]")
    expect(out.role).toBe("user")
  })

  test("leaves class instances and non-strings alone", () => {
    const buffer = new Uint8Array([1, 2, 3])
    const out = Redact.deep({ n: 42, ok: true, buffer })
    expect(out.n).toBe(42)
    expect(out.ok).toBe(true)
    expect(out.buffer).toBe(buffer)
  })
})
