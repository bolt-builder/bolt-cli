import { describe, expect, test } from "bun:test"
import { invite } from "../../src/cli/cmd/pair"

describe("invite", () => {
  test("builds the join command", () => {
    expect(invite({ url: "http://127.0.0.1:4096", session: "ses_123" })).toBe(
      "bolt pair --join http://127.0.0.1:4096 --session ses_123",
    )
  })

  test("appends a password placeholder when the server is secured", () => {
    expect(invite({ url: "http://192.168.1.10:4096", session: "ses_123", password: true })).toBe(
      "bolt pair --join http://192.168.1.10:4096 --session ses_123 --password <password>",
    )
  })
})
