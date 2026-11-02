import { describe, expect, test } from "bun:test"
import { endpoint } from "../../src/cli/cmd/push"
import { valid } from "../../src/session/bundle"

describe("endpoint", () => {
  test("resolves a server base url to the handoff endpoint", () => {
    expect(endpoint("http://dev-box:4096")).toBe("http://dev-box:4096/handoff/session")
    expect(endpoint("https://dev-box:4096/some/path")).toBe("https://dev-box:4096/handoff/session")
  })

  test("rejects non-http urls and garbage", () => {
    expect(endpoint("ssh://dev-box")).toBeUndefined()
    expect(endpoint("not a url")).toBeUndefined()
    expect(endpoint("")).toBeUndefined()
  })
})

describe("valid", () => {
  const bundle = {
    info: { id: "ses_123" },
    messages: [{ info: { id: "msg_1" }, parts: [{ id: "prt_1" }] }],
  }

  test("accepts the export bundle shape", () => {
    expect(valid(bundle)).toBe(true)
    expect(valid({ info: { id: "ses_123" }, messages: [] })).toBe(true)
  })

  test("rejects payloads missing session or message identity", () => {
    expect(valid(undefined)).toBe(false)
    expect(valid("[]")).toBe(false)
    expect(valid({ info: {}, messages: [] })).toBe(false)
    expect(valid({ info: { id: "ses_123" } })).toBe(false)
    expect(valid({ info: { id: "ses_123" }, messages: [{ parts: [] }] })).toBe(false)
    expect(valid({ info: { id: "ses_123" }, messages: [{ info: { id: "msg_1" } }] })).toBe(false)
  })
})
