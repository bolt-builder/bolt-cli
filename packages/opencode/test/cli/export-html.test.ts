import { describe, expect, test } from "bun:test"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { render, steps } from "../../src/cli/cmd/export-html"

const messages = [
  {
    info: {
      id: "msg_1",
      sessionID: "ses_1",
      role: "user",
      time: { created: 1 },
      agent: "build",
      model: { providerID: "anthropic", modelID: "claude" },
    },
    parts: [
      {
        id: "prt_1",
        sessionID: "ses_1",
        messageID: "msg_1",
        type: "text",
        text: '<b>hello</b> & "goodbye"',
      },
    ],
  },
  {
    info: {
      id: "msg_2",
      sessionID: "ses_1",
      role: "assistant",
      time: { created: 2 },
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
      { id: "prt_2", sessionID: "ses_1", messageID: "msg_2", type: "step-start" },
      { id: "prt_3", sessionID: "ses_1", messageID: "msg_2", type: "text", text: "   " },
      { id: "prt_4", sessionID: "ses_1", messageID: "msg_2", type: "text", text: "listing files" },
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
          output: "<script>alert(1)</script>",
          title: "list files",
          metadata: {},
          time: { start: 1, end: 2 },
        },
      },
    ],
  },
] as unknown as SessionV1.WithParts[]

describe("steps", () => {
  test("flattens messages into replay steps, skipping blank text and non-content parts", () => {
    const result = steps(messages)
    expect(result.map((step) => step.role)).toEqual(["user", "assistant", "tool"])
    expect(result[0].label).toBe("User")
    expect(result[0].text).toBe('<b>hello</b> & "goodbye"')
    expect(result[1].text).toBe("listing files")
    expect(result[2].label).toBe("bash")
    expect(result[2].text).toBe("list files")
  })

  test("collapses tool input and output into the step detail", () => {
    const tool = steps(messages)[2]
    expect(tool.detail).toContain('"command": "ls"')
    expect(tool.detail).toContain("output:\n<script>alert(1)</script>")
  })

  test("keeps error state tool calls", () => {
    const errored = steps([
      {
        info: messages[1].info,
        parts: [
          {
            id: "prt_9",
            sessionID: "ses_1",
            messageID: "msg_2",
            type: "tool",
            callID: "call_9",
            tool: "read",
            state: { status: "error", input: { path: "x" }, error: "boom", time: { start: 1, end: 2 } },
          },
        ],
      },
    ] as unknown as SessionV1.WithParts[])
    expect(errored[0].text).toBe("error")
    expect(errored[0].detail).toContain("error:\nboom")
  })
})

describe("render", () => {
  test("escapes user and model content", () => {
    const html = render('my <session> & "replay"', messages)
    expect(html).toContain("my &lt;session&gt; &amp; &quot;replay&quot;")
    expect(html).toContain("&lt;b&gt;hello&lt;/b&gt; &amp; &quot;goodbye&quot;")
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).not.toContain("<b>hello</b>")
  })

  test("is self-contained with timeline navigation", () => {
    const html = render("session", messages)
    expect(html).not.toContain("http://")
    expect(html).not.toContain("https://")
    expect(html).toContain("<style>")
    expect(html).toContain('id="prev"')
    expect(html).toContain('id="next"')
    expect(html).toContain('id="progress"')
    expect(html).toContain("ArrowRight")
    expect(html).toContain('data-step="2"')
    expect(html).not.toContain('data-step="3"')
  })

  test("renders an empty session without steps", () => {
    const html = render("empty", [])
    expect(html).not.toContain("data-step")
    expect(html).toContain('id="count"')
  })
})
