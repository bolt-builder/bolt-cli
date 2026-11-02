import { expect, test } from "bun:test"
import type { SessionMessageInfo } from "@opencode/client"
import { takeDraft } from "../src/component/prompt/draft-stash"
import { createAppFixture } from "./fixture/app"
import { directory, json } from "./fixture/tui-client"
import { waitForHighlightedFrame } from "./fixture/frame"

for (const width of [44, 100])
  test(`legacy transcript actions preserve running tools, errors and todo history at ${width} columns`, async () => {
    takeDraft(undefined)
    const session = {
      id: "ses_transcript",
      title: "Transcript preferences",
      projectID: "project",
      location: { directory },
      time: { created: 1, updated: 2 },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    }
    const messages: SessionMessageInfo[] = [
      { type: "user", id: "msg_question", text: "Inspect the project", time: { created: 1_735_804_800_000 } },
      {
        type: "assistant",
        id: "msg_result",
        agent: "build",
        model: { providerID: "fixture", id: "fixture" },
        time: { created: 1_735_804_801_000 },
        content: [
          {
            type: "tool",
            id: "done",
            name: "done_fixture",
            time: { created: 1, completed: 2 },
            state: { status: "completed", input: {}, content: [{ type: "text", text: "done" }] },
          },
          {
            type: "tool",
            id: "running",
            name: "running_fixture",
            time: { created: 1 },
            state: { status: "running", input: {}, metadata: {} },
          },
          {
            type: "tool",
            id: "failed",
            name: "failed_fixture",
            time: { created: 1, completed: 2 },
            state: { status: "error", input: {}, error: { message: "Keep this failure visible", type: "failed" } },
          },
          {
            type: "tool",
            id: "todos",
            name: "todowrite",
            time: { created: 1, completed: 2 },
            state: {
              status: "completed",
              input: { todos: [{ content: "Retained todo", status: "in_progress" }] },
              content: [{ type: "text", text: "saved" }],
            },
          },
        ],
      },
    ]
    let exports = 0
    await using setup = await createAppFixture({
      width,
      height: 48,
      args: { sessionID: session.id },
      config: {
        animations: false,
        session: { sidebar: "hide", grouping: "none", verbosity: "high" },
        keybinds: { "session.toggle.compact": "f6", "session.toggle.timestamps": "f7" },
      },
      fetch: (url) => {
        if (url.pathname === `/api/session/${session.id}`) return json({ data: session })
        if (url.pathname === "/api/session") return json({ data: [session], cursor: {} })
        if (url.pathname === `/api/session/${session.id}/message`)
          return json({ data: messages.toReversed(), cursor: {} })
        if (
          url.pathname === `/api/session/${session.id}/inbox` ||
          url.pathname === `/api/session/${session.id}/permission`
        )
          return json({ data: [], cursor: {} })
        if (url.pathname === `/api/experimental/session/${session.id}/export`) {
          exports++
          return json({ data: { info: session, messages } })
        }
      },
    })
    await setup.ready
    await setup.waitForFrame((frame) => frame.includes("done_fixture") && frame.includes("running_fixture"))
    const timestamp = () => setup.renderer.root.findDescendantById("message-timestamp-msg_question")
    expect(timestamp()).toBeUndefined()
    setup.mockInput.pressKey("F7")
    await setup.waitForFrame(() => timestamp() !== undefined)
    expect(setup.config().session?.timestamps).toBe("show")
    setup.mockInput.pressKey("F6")
    await setup.waitForFrame(
      (frame) =>
        !frame.includes("done_fixture") && frame.includes("running_fixture") && frame.includes("failed_fixture"),
    )
    expect(setup.config().session?.details).toBe(false)
    expect(timestamp()).toBeUndefined()
    setup.events.emit({
      id: "evt_running_completed",
      type: "session.tool.success",
      created: 3,
      durable: { aggregateID: session.id, seq: 1, version: 2 },
      data: {
        sessionID: session.id,
        assistantMessageID: "msg_result",
        id: "running",
        metadata: {},
        content: [{ type: "text", text: "finished" }],
        executed: true,
      },
    })
    await setup.waitForFrame((frame) => !frame.includes("running_fixture") && frame.includes("failed_fixture"), {
      maxPasses: 100,
    })
    await setup.mockInput.typeText("/todo")
    await setup.waitForFrame((frame) => frame.includes("View todos"))
    setup.mockInput.pressEnter()
    await setup.waitForFrame(
      (frame) => frame.includes("Todos") && frame.includes("Retained todo") && frame.includes("in progress"),
    )
    setup.mockInput.pressEscape()
    await setup.waitFor(() => setup.renderer.currentFocusedEditor !== undefined)
    setup.mockInput.pressKey("F6")
    await setup.waitForFrame((frame) => frame.includes("done_fixture") && timestamp() !== undefined)
    expect(setup.config().session?.details).toBe(true)
    await setup.mockInput.typeText("/copy-session")
    await setup.waitForFrame((frame) => frame.includes("/copy-session"))
    await setup.renderOnce()
    setup.mockInput.pressEnter()
    await setup.waitForFrame(() => exports === 1, { maxPasses: 100 })
    await waitForHighlightedFrame(setup, (frame) => frame.includes("Inspect the project"))
  })
