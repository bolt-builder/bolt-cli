import { describe, expect, test } from "bun:test"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { markdown } from "../../src/cli/cmd/export-md"

const messages = [
  {
    info: {
      id: "msg_1",
      sessionID: "ses_1",
      role: "user",
      time: { created: 1754500000000 },
      agent: "build",
      model: { providerID: "anthropic", modelID: "claude" },
    },
    parts: [
      { id: "prt_1", sessionID: "ses_1", messageID: "msg_1", type: "text", text: "fix the bug" },
      { id: "prt_2", sessionID: "ses_1", messageID: "msg_1", type: "file", url: "file:///a.txt", filename: "a.txt" },
    ],
  },
  {
    info: {
      id: "msg_2",
      sessionID: "ses_1",
      role: "assistant",
      time: { created: 1754500001000 },
      parentID: "msg_1",
      modelID: "claude",
      providerID: "anthropic",
      mode: "build",
      agent: "build",
      path: { cwd: "/tmp", root: "/tmp" },
      cost: 0,
      tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
    },
    parts: [
      { id: "prt_3", sessionID: "ses_1", messageID: "msg_2", type: "step-start" },
      { id: "prt_4", sessionID: "ses_1", messageID: "msg_2", type: "text", text: "   " },
      {
        id: "prt_5",
        sessionID: "ses_1",
        messageID: "msg_2",
        type: "tool",
        callID: "call_1",
        tool: "bash",
        state: {
          status: "completed",
          input: { command: "ls" },
          output: "files",
          title: "ls",
          metadata: {},
          time: { start: 1, end: 2 },
        },
      },
      { id: "prt_6", sessionID: "ses_1", messageID: "msg_2", type: "text", text: "done" },
    ],
  },
  {
    info: {
      id: "msg_3",
      sessionID: "ses_1",
      role: "assistant",
      time: { created: 1754500002000 },
      parentID: "msg_1",
      modelID: "claude",
      providerID: "anthropic",
      mode: "build",
      agent: "build",
      path: { cwd: "/tmp", root: "/tmp" },
      cost: 0,
      tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
    },
    parts: [{ id: "prt_7", sessionID: "ses_1", messageID: "msg_3", type: "step-start" }],
  },
] as unknown as SessionV1.WithParts[]

describe("export.markdown", () => {
  const output = markdown("my session", messages)

  test("starts with the session title", () => {
    expect(output.startsWith("# my session\n")).toBeTrue()
  })

  test("renders user and assistant sections with timestamps", () => {
    expect(output).toContain("## User · 2025-08-06T")
    expect(output).toContain("## Assistant (build · anthropic/claude) · 2025-08-06T")
  })

  test("renders text, attachments, and tool calls", () => {
    expect(output).toContain("fix the bug")
    expect(output).toContain("- attached `a.txt`")
    expect(output).toContain("- `bash` ls")
    expect(output).toContain("done")
  })

  test("skips blank text and synthetic parts", () => {
    expect(output).not.toContain("step-start")
    expect(
      output
        .trimEnd()
        .split("\n\n")
        .every((block) => block.trim().length > 0),
    ).toBeTrue()
  })

  test("omits messages with nothing to show", () => {
    expect(output.match(/## Assistant/g)).toHaveLength(1)
  })

  test("ends with a trailing newline", () => {
    expect(output.endsWith("\n")).toBeTrue()
  })
})
