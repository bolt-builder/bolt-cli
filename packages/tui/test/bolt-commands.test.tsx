import { expect, test } from "bun:test"
import { TextareaRenderable } from "@opentui/core"
import { takeDraft } from "../src/component/prompt/draft-stash"
import { createAppFixture } from "./fixture/app"
import { directory, json } from "./fixture/tui-client"
import { subagentText } from "../src/feature-plugins/system/process"

test("Vim edits the real prompt, preserves Unicode, and persists its toggle", async () => {
  takeDraft(undefined)
  await using setup = await createAppFixture({
    config: { animations: false, prompt: { vim: true }, keybinds: { "prompt.vim.toggle": "f6" } },
  })
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("INSERT"))
  const input = setup.renderer.currentFocusedEditor
  if (!(input instanceof TextareaRenderable)) throw new Error("expected prompt")
  await setup.mockInput.typeText("one two three")
  setup.mockInput.pressEscape()
  await setup.waitForFrame((frame) => frame.includes("NORMAL"))
  await setup.mockInput.typeText("0dw")
  await setup.waitFor(() => input.plainText === "two three")
  await setup.mockInput.typeText("u")
  await setup.waitFor(() => input.plainText === "one two three")
  await setup.mockInput.typeText("viw")
  setup.mockInput.pressEscape()
  input.setText("a😀e\u0301界z")
  input.cursorOffset = 0
  await setup.mockInput.typeText("lx")
  await setup.waitFor(() => input.plainText === "ae\u0301界z")
  await setup.mockInput.typeText("x")
  await setup.waitFor(() => input.plainText === "a界z")
  await setup.mockInput.typeText("x")
  await setup.waitFor(() => input.plainText === "az")
  setup.mockInput.pressKey("F6")
  await setup.waitFor(() => setup.config().prompt?.vim === false)
  await setup.mockInput.typeText("i")
  await setup.waitFor(() => input.plainText.includes("i"))
})

for (const auto of [false, true]) {
  test(`auto approval toggles and persists with startup --auto=${auto}`, async () => {
    takeDraft(undefined)
    await using setup = await createAppFixture({
      args: { auto },
      config: { animations: false, keybinds: { "permission.mode": "f6" } },
    })
    await setup.ready
    await setup.waitForFrame((frame) => frame.includes("commands"))
    setup.mockInput.pressKey("F6")
    await setup.waitFor(() => setup.config().session?.permissions === (auto ? "prompt" : "autoaccept"))
    setup.mockInput.pressKey("F6")
    await setup.waitFor(() => setup.config().session?.permissions === (auto ? "autoaccept" : "prompt"))
    expect(setup.config().session?.permissions).toBe(auto ? "autoaccept" : "prompt")
  })
}

test("plan mode returns to the previously selected specialist agent", async () => {
  takeDraft(undefined)
  await using setup = await createAppFixture({
    config: { animations: false, keybinds: { "agent.plan": "f6" } },
    fetch: (url) => {
      if (url.pathname !== "/api/agent") return
      return json({
        location: { directory, project: { id: "project", directory, canonical: directory } },
        data: ["debug", "build", "plan"].map((id) => ({ id, mode: "primary", hidden: false, permissions: [] })),
      })
    },
  })
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("Debug"))
  setup.mockInput.pressKey("F6")
  await setup.waitForFrame((frame) => frame.includes("Plan"))
  setup.mockInput.pressKey("F6")
  await setup.waitForFrame((frame) => frame.includes("Debug"))
  expect(setup.captureCharFrame()).toContain("back to debug")
})

test("process manager reads V2 jobs, shows output, and cancels running work", async () => {
  takeDraft(undefined)
  let cancelled = false
  let cancelCount = 0
  const job = {
    id: "job_demo",
    title: "Compile project",
    type: "shell",
    status: "running",
    started_at: 1,
    output: "Compiling the project",
  }
  await using setup = await createAppFixture({
    config: { animations: false, keybinds: { "background_job.list": "f6" } },
    fetch: (url) => {
      if (url.pathname === "/api/rpc/bolt.process/list")
        return json({ output: [{ ...job, status: cancelled ? "cancelled" : "running" }] })
      if (url.pathname === "/api/rpc/bolt.process/output") return json({ output: "Compiling the project" })
      if (url.pathname === "/api/rpc/bolt.process/cancel") {
        cancelled = true
        cancelCount++
        return json({ output: { ...job, status: "cancelled" } })
      }
    },
  })
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("commands"))
  setup.mockInput.pressKey("F6")
  await setup.waitForFrame((frame) => frame.includes("Compile project"))
  setup.mockInput.pressEnter()
  await setup.waitForFrame((frame) => frame.includes("Compiling the project"))
  setup.mockInput.pressKey("o", { ctrl: true })
  await setup.waitForFrame((frame) => frame.includes("cancelled"))
  expect(cancelled).toBe(true)
  setup.mockInput.pressKey("o", { ctrl: true })
  await Bun.sleep(100)
  expect(cancelCount).toBe(1)
})

test("process details follow only the selected subagent's live text", async () => {
  takeDraft(undefined)
  let listCalls = 0
  const jobs = ["one", "two"].map((name, index) => ({
    id: `ses_process_${name}`,
    title: `Agent ${name}`,
    type: "subagent",
    status: "running",
    started_at: 2 - index,
  }))
  const requested = new Set<string>()
  await using setup = await createAppFixture({
    config: { animations: false, keybinds: { "background_job.list": "f6" } },
    fetch: (url) => {
      if (url.pathname === "/api/rpc/bolt.process/list") {
        listCalls++
        return json({ output: jobs })
      }
      const match = url.pathname.match(/^\/api\/session\/(ses_process_(?:one|two))\/message$/)
      if (match) {
        requested.add(match[1])
        return json({
          data: [{
            type: "assistant",
            id: `msg_${match[1]}`,
            agent: "explore",
            model: { providerID: "fixture", id: "fixture" },
            time: { created: 1 },
            content: [{ type: "text", text: "" }],
          }],
          cursor: {},
        })
      }
    },
  })
  const stream = (name: string, delta: string) => setup.events.emit({
    id: `evt_process_${name}`,
    created: Date.now(),
    type: "session.text.delta",
    data: { sessionID: `ses_process_${name}`, assistantMessageID: `msg_ses_process_${name}`, ordinal: 0, delta },
  })
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("commands"))
  setup.mockInput.pressKey("F6")
  await setup.waitForFrame((frame) => frame.includes("Agent one"))
  setup.mockInput.pressEnter()
  await setup.waitFor(() => requested.has("ses_process_one"))
  await setup.waitForFrame((frame) => frame.includes("No output yet"))
  await Bun.sleep(100)
  stream("two", "WRONG SESSION")
  stream("one", "FIRST LIVE RESULT")
  await setup.waitForFrame((frame) => frame.includes("FIRST LIVE RESULT"))
  expect(setup.captureCharFrame()).not.toContain("WRONG SESSION")
  setup.mockInput.pressKey("BACKSPACE")
  await setup.waitForFrame((frame) => frame.includes("Agent two"))
  await setup.mockInput.typeText("Agent two")
  setup.mockInput.pressEnter()
  await setup.waitFor(() => requested.has("ses_process_two"))
  await setup.waitForFrame((frame) => frame.includes("No output yet"))
  await Bun.sleep(100)
  stream("two", "SECOND LIVE RESULT")
  await setup.waitForFrame((frame) => frame.includes("SECOND LIVE RESULT"))
  expect(setup.captureCharFrame()).not.toContain("FIRST LIVE RESULT")
  setup.mockInput.pressEscape()
  await setup.waitForFrame((frame) => frame.includes("commands"))
  const callsAfterClose = listCalls
  await Bun.sleep(2100)
  expect(listCalls).toBe(callsAfterClose)
})

test("subagent output is limited to the newest text of the latest assistant", () => {
  const output = subagentText([{
    type: "assistant",
    id: "msg_bounded",
    agent: "explore",
    model: { providerID: "fixture", id: "fixture" },
    time: { created: 1 },
    content: [{ type: "text", text: "old" + "x".repeat(70_000) }, { type: "text", text: "tail" }],
  }])
  expect(output?.length).toBe(65_536)
  expect(output?.endsWith("\n\ntail")).toBe(true)
  expect(output?.startsWith("old")).toBe(false)
})

test("cost alert slash command accepts its old alias without requiring a model", async () => {
  takeDraft(undefined)
  await using setup = await createAppFixture()
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("commands"))
  await setup.mockInput.typeText("/cost 2")
  setup.mockInput.pressEscape()
  setup.mockInput.pressEnter()
  await setup.waitForFrame((frame) => frame.includes("Cost alert set to $2.00"))
  expect(setup.renderer.currentFocusedEditor?.plainText).toBe("")
  await setup.mockInput.typeText("/cost-alert off")
  setup.mockInput.pressEscape()
  setup.mockInput.pressEnter()
  await setup.waitForFrame((frame) => frame.includes("Cost alert disabled"))
})

test("memory alias sends arguments to the V2 RPC and displays the result without a model", async () => {
  takeDraft(undefined)
  const calls: unknown[] = []
  await using setup = await createAppFixture({
    fetch: async (url, request) => {
      if (url.pathname !== "/api/rpc/bolt.memory/command") return
      calls.push(await request.json())
      return json({ output: { root: "/fixture/memory", text: "Remembered fixture convention" } })
    },
  })
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("commands"))
  await setup.mockInput.typeText("/mem remember use Bun")
  setup.mockInput.pressEscape()
  setup.mockInput.pressEnter()
  await setup.waitForFrame((frame) => frame.includes("Remembered fixture convention"))
  expect(calls).toHaveLength(1)
  expect(calls[0]).toMatchObject({ input: { text: "remember use Bun" } })
})

test("sandbox toggles the current session through RPC and reflects server metadata", async () => {
  takeDraft(undefined)
  const session = {
    id: "ses_sandbox",
    title: "Sandbox fixture",
    projectID: "project",
    location: { directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: 1, updated: 2 },
    metadata: { sandbox: false },
  }
  const calls: unknown[] = []
  await using setup = await createAppFixture({
    args: { sessionID: session.id },
    config: { animations: false, tabs: { mode: "on" }, keybinds: { "session.sandbox": "f6" } },
    fetch: async (url, request) => {
      if (url.pathname === `/api/session/${session.id}`) return json({ data: session })
      if (/^\/api\/session\/ses_sandbox\/(message|inbox|permission)$/.test(url.pathname))
        return json({ data: [], cursor: {} })
      if (url.pathname !== "/api/rpc/bolt.sandbox/set") return
      const body = await request.json()
      calls.push(body)
      session.metadata.sandbox = body.input.enabled
      return json({ output: { enabled: session.metadata.sandbox } })
    },
  })
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("Sandbox fixture"))
  setup.mockInput.pressKey("F6")
  await setup.waitForFrame((frame) => frame.includes("Filesystem sandbox enabled"))
  expect(calls[0]).toMatchObject({ input: { sessionID: session.id, enabled: true } })
  setup.events.emit({
    type: "session.metadata.updated",
    data: { sessionID: session.id, metadata: session.metadata },
    id: "evt_sandbox",
    created: Date.now(),
    durable: { aggregateID: session.id, seq: 1, version: 1 },
  })
  await setup.waitForFrame((frame) => frame.includes("Filesystem sandbox on"))
  setup.mockInput.pressKey("F6")
  await setup.waitForFrame((frame) => frame.includes("Filesystem sandbox disabled"))
  expect(calls[1]).toMatchObject({ input: { sessionID: session.id, enabled: false } })
})

test("plan mode does not claim success when the plan agent is unavailable", async () => {
  takeDraft(undefined)
  await using setup = await createAppFixture({
    config: { animations: false, keybinds: { "agent.plan": "f6" } },
    fetch: (url) => {
      if (url.pathname !== "/api/agent") return
      return json({
        location: { directory, project: { id: "project", directory, canonical: directory } },
        data: [{ id: "build", mode: "primary", hidden: false, permissions: [] }],
      })
    },
  })
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("Build"))
  setup.mockInput.pressKey("F6")
  const frame = await setup.waitForFrame((frame) => frame.includes("Plan agent is unavailable"))
  expect(frame).not.toContain("Plan mode on")
})

test("sandbox setup failure keeps a newly created session accessible", async () => {
  takeDraft(undefined)
  const session = {
    id: "ses_sandbox_failure",
    title: "Created sandbox session",
    projectID: "project",
    location: { directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: 1, updated: 2 },
  }
  await using setup = await createAppFixture({
    config: { animations: false, keybinds: { "session.sandbox": "f6" } },
    fetch: (url, request) => {
      if (url.pathname === "/api/session" && request.method === "POST") return json({ data: session })
      if (url.pathname === `/api/session/${session.id}`) return json({ data: session })
      if (url.pathname === "/api/rpc/bolt.sandbox/set") return new Response("fixture error", { status: 500 })
      if (/^\/api\/session\/ses_sandbox_failure\/(message|inbox|permission)$/.test(url.pathname))
        return json({ data: [], cursor: {} })
    },
  })
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("commands"))
  setup.mockInput.pressKey("F6")
  await setup.waitForFrame((frame) => frame.includes("Created sandbox session"))
  expect(setup.captureCharFrame()).toContain("Created sandbox session")
})

test("child sessions do not advertise a sidebar that they cannot display", async () => {
  takeDraft(undefined)
  const session = {
    id: "ses_child_sidebar",
    parentID: "ses_parent",
    title: "Child sidebar fixture",
    projectID: "project",
    location: { directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: 1, updated: 2 },
  }
  await using setup = await createAppFixture({
    args: { sessionID: session.id },
    config: { animations: false, keybinds: { "session.sidebar.toggle": "f6" } },
    fetch: (url) => {
      if (url.pathname === `/api/session/${session.id}`) return json({ data: session })
      if (url.pathname === "/api/session/ses_parent")
        return json({ data: { ...session, id: "ses_parent", parentID: undefined, title: "Parent fixture" } })
      if (/^\/api\/session\/ses_child_sidebar\/(message|inbox|permission)$/.test(url.pathname))
        return json({ data: [], cursor: {} })
    },
  })
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("Child sidebar fixture"))
  await setup.mockInput.typeText("/sidebar")
  await Bun.sleep(150)
  expect(setup.captureCharFrame()).not.toContain("Show sidebar")
  setup.mockInput.pressKey("F6")
  await Bun.sleep(100)
  expect(setup.config().session?.sidebar).toBeUndefined()
})
