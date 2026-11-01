import { expect, test } from "bun:test"
import { TextareaRenderable } from "@opentui/core"
import { takeDraft } from "../src/component/prompt/draft-stash"
import { createAppFixture } from "./fixture/app"
import { directory, json } from "./fixture/tui-client"

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
      if (url.pathname === "/api/rpc/bolt.process/cancel") {
        cancelled = true
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
