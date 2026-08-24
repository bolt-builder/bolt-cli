import { describe, expect, test } from "bun:test"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { build, lines } from "../../src/cli/cmd/grep"

describe("grep.build", () => {
  test("compiles a plain pattern", () => {
    expect(build("billing", false)?.test("billing bug")).toBeTrue()
  })

  test("compiles a regex pattern", () => {
    expect(build("bug\\d+", false)?.test("bug42")).toBeTrue()
  })

  test("supports case-insensitive matching", () => {
    expect(build("BILLING", true)?.test("billing")).toBeTrue()
    expect(build("BILLING", false)?.test("billing")).toBeFalse()
  })

  test("returns undefined for invalid patterns", () => {
    expect(build("(", false)).toBeUndefined()
  })
})

const parts = [
  { id: "prt_1", sessionID: "ses_1", messageID: "msg_1", type: "text", text: "first line\nbilling bug here\nlast" },
  { id: "prt_2", sessionID: "ses_1", messageID: "msg_1", type: "reasoning", text: "thinking about billing" },
  {
    id: "prt_3",
    sessionID: "ses_1",
    messageID: "msg_1",
    type: "tool",
    callID: "call_1",
    tool: "bash",
    state: {
      status: "completed",
      input: {},
      output: "billing.ts\nother.ts",
      title: "ls",
      metadata: {},
      time: { start: 1, end: 2 },
    },
  },
  {
    id: "prt_4",
    sessionID: "ses_1",
    messageID: "msg_1",
    type: "tool",
    callID: "call_2",
    tool: "bash",
    state: { status: "error", input: {}, error: "billing exploded", time: { start: 1, end: 2 } },
  },
  { id: "prt_5", sessionID: "ses_1", messageID: "msg_1", type: "step-start" },
] as unknown as SessionV1.Part[]

describe("grep.lines", () => {
  test("matches text, reasoning, and completed tool output line by line", () => {
    expect(lines(parts, /billing/)).toEqual(["billing bug here", "thinking about billing", "billing.ts"])
  })

  test("skips non-matching lines and synthetic parts", () => {
    expect(lines(parts, /nothing-here/)).toEqual([])
  })

  test("respects regex anchors per line", () => {
    expect(lines(parts, /^billing/)).toEqual(["billing bug here", "billing.ts"])
  })
})
