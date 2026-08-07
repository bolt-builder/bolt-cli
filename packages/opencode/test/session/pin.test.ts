import { describe, expect, test } from "bun:test"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { SessionPin } from "@/session/pin"

function message(parts: Partial<SessionV1.Part>[]): SessionV1.WithParts {
  return {
    info: { id: "msg_1", role: "user" },
    parts,
  } as SessionV1.WithParts
}

const attached = message([
  { type: "file", url: "file:///repo/src/auth.ts?start=1", filename: "auth.ts", mime: "text/plain" },
])

const read = message([
  {
    type: "tool",
    tool: "read",
    state: {
      status: "completed",
      input: { filePath: "/repo/src/config/config.ts" },
      output: "",
      title: "",
      metadata: {},
      time: { start: 0, end: 0 },
    },
  },
])

describe("session.pin.resolve", () => {
  test("returns nothing when no pins are configured", () => {
    expect(SessionPin.resolve({ pins: [], messages: [attached, read] })).toEqual([])
  })

  test("resolves a pin against attached file parts", () => {
    const blocks = SessionPin.resolve({ pins: ["src/auth.ts"], messages: [attached] })
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toContain("/repo/src/auth.ts: pinned file")
    expect(blocks[0]).toContain("Pinned context")
  })

  test("resolves a pin against completed tool call file paths", () => {
    const blocks = SessionPin.resolve({ pins: ["config/config.ts"], messages: [read] })
    expect(blocks[0]).toContain("/repo/src/config/config.ts: pinned file")
  })

  test("keeps unmatched pins as verbatim facts", () => {
    const blocks = SessionPin.resolve({
      pins: ["the API only supports batches of 100"],
      messages: [attached],
    })
    expect(blocks[0]).toContain("- the API only supports batches of 100")
    expect(blocks[0]).not.toContain("pinned file")
  })

  test("matches whole path segments only", () => {
    const blocks = SessionPin.resolve({ pins: ["uth.ts"], messages: [attached] })
    expect(blocks[0]).toContain("- uth.ts")
    expect(blocks[0]).not.toContain("pinned file")
  })

  test("ignores running tool calls and non-file parts", () => {
    const busy = message([
      { type: "text", text: "hello" },
      {
        type: "tool",
        tool: "read",
        state: { status: "running", input: { filePath: "/repo/src/db.ts" }, time: { start: 0 } },
      },
    ])
    const blocks = SessionPin.resolve({ pins: ["src/db.ts"], messages: [busy] })
    expect(blocks[0]).toContain("- src/db.ts")
    expect(blocks[0]).not.toContain("pinned file")
  })
})
