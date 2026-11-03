import { expect, test } from "bun:test"
import { InputRenderable, TextareaRenderable } from "@opentui/core"
import { directory, json } from "./fixture/tui-client"
import { tmpdir } from "./fixture/fixture"
import { createAppFixture } from "./fixture/app"

test("custom commands commit the captured agent, model and variant before execution", async () => {
  await using state = await tmpdir()
  const agent = Promise.withResolvers<Response>()
  const model = Promise.withResolvers<Response>()
  const mutations: { type: string; body: unknown }[] = []
  const location = { directory, project: { id: "project", directory, canonical: directory } }
  const session = {
    id: `ses_${crypto.randomUUID()}`,
    projectID: "project",
    title: "Command selection fixture",
    agent: "build",
    model: { providerID: "demo", id: "first" },
    location: { directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: 0, updated: 0 },
  }
  await using setup = await createAppFixture({
    state: state.path,
    config: {
      animations: false,
      keybinds: { "agent.cycle": "f6", "variant.cycle": "f7", "model.list": "f8" },
    },
    args: { sessionID: session.id },
    fetch: async (url, request) => {
      if (url.pathname === "/api/location") return json(location)
      if (url.pathname === "/api/agent")
        return json({
          location,
          data: ["build", "plan"].map((id) => ({ id, mode: "primary", hidden: false, permissions: [] })),
        })
      if (url.pathname === "/api/provider") return json({ location, data: [{ id: "demo", name: "Demo" }] })
      if (url.pathname === "/api/model")
        return json({
          location,
          data: ["first", "second"].map((id) => ({
            id,
            providerID: "demo",
            name: `${id} model`,
            variants: [{ id: "low" }, { id: "high" }],
            cost: [],
            time: { released: 0 },
          })),
        })
      if (url.pathname === "/api/command")
        return json({ location, data: [{ name: "review", description: "Review the input" }] })
      if (url.pathname === `/api/session/${session.id}`) return json({ data: session })
      if (/^\/api\/session\/[^/]+\/(message|inbox|permission)$/.test(url.pathname))
        return json({ data: [], cursor: {} })
      const type = url.pathname.match(/^\/api\/session\/[^/]+\/(agent|model|command)$/)?.[1]
      if (!type) return
      mutations.push({ type, body: await request.json() })
      return type === "agent" ? agent.promise : type === "model" ? model.promise : new Response(null, { status: 204 })
    },
  })
  try {
    await setup.ready
    await setup.waitForFrame((frame) => frame.includes("Build · first model"))
    setup.mockInput.pressKey("F6")
    await setup.waitForFrame((frame) => frame.includes("Plan ·"))
    setup.mockInput.pressKey("F8")
    await setup.waitForFrame(
      (frame) => frame.includes("Select model") && setup.renderer.currentFocusedRenderable instanceof InputRenderable,
    )
    await setup.mockInput.typeText("second")
    await setup.renderOnce()
    setup.mockInput.pressEnter()
    // DialogSelect focuses its filter on a timer; typing earlier is dropped and Enter picks "Default".
    await setup.waitForFrame(
      (frame) =>
        frame.includes("Select variant") &&
        frame.includes("low") &&
        setup.renderer.currentFocusedRenderable instanceof InputRenderable,
    )
    await setup.mockInput.typeText("low")
    await setup.renderOnce()
    setup.mockInput.pressEnter()
    await setup.waitForFrame(
      (frame) =>
        frame.includes("Plan · second model Demo · low") &&
        setup.renderer.currentFocusedRenderable instanceof TextareaRenderable,
    )
    await setup.mockInput.typeText("/review selected input")
    setup.mockInput.pressEscape()
    setup.mockInput.pressEnter()
    await setup.waitFor(() => mutations.length > 0)
    expect(mutations).toEqual([{ type: "agent", body: { agent: "plan" } }])

    // A later local edit must not change the in-flight command's selection.
    await waitForFrame(setup, (frame) => frame.includes("Plan · second model Demo · low"))
    setup.mockInput.pressKey("F7")
    await waitForFrame(setup, (frame) => frame.includes("high"))
    agent.resolve(new Response(null, { status: 204 }))
    await setup.waitFor(() => mutations.length === 2)
    expect(mutations[1]).toEqual({
      type: "model",
      body: { model: { providerID: "demo", id: "second", variant: "low" } },
    })
    model.resolve(new Response(null, { status: 204 }))
    await setup.waitFor(() => mutations.length === 3)
    expect(mutations[2]).toEqual({
      type: "command",
      body: { name: "review", text: "selected input", files: [], agents: [], delivery: "steer" },
    })
  } finally {
    agent.resolve(new Response(null, { status: 204 }))
    model.resolve(new Response(null, { status: 204 }))
  }
})

test("home ideas use the selected model and insert a suggestion without sending it", async () => {
  const location = { directory, project: { id: "project", directory, canonical: directory } }
  const requests: unknown[] = []
  await using setup = await createAppFixture({
    fetch: async (url, request) => {
      if (url.pathname === "/api/agent")
        return json({ location, data: [{ id: "build", mode: "primary", hidden: false, permissions: [] }] })
      if (url.pathname === "/api/provider") return json({ location, data: [{ id: "demo", name: "Demo" }] })
      if (url.pathname === "/api/model")
        return json({
          location,
          data: [{ id: "selected", providerID: "demo", name: "Selected", variants: [], cost: [], time: { released: 0 } }],
        })
      if (url.pathname === "/api/fs/list") {
        const entries = url.searchParams.get("path") === "src"
          ? [{ path: "src/app.ts", type: "file" }, { path: "src/.secret", type: "file" }]
          : [{ path: "src", type: "directory" }, { path: ".env", type: "file" }]
        return json({ location, data: entries })
      }
      if (url.pathname === "/api/experimental/generate/text") {
        requests.push(await request.json())
        return json({ data: { text: "1. Improve the app\n2. Add tests\n3. Review errors" } })
      }
    },
  })
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("Selected") && setup.renderer.currentFocusedRenderable instanceof TextareaRenderable)
  await setup.mockInput.typeText("/ideas")
  setup.mockInput.pressEscape()
  setup.mockInput.pressEnter()
  await setup.waitForFrame((frame) => frame.includes("Improve the app") && requests.length === 1)
  expect(requests).toHaveLength(1)
  expect(requests[0]).toMatchObject({ model: { providerID: "demo", id: "selected" } })
  expect(JSON.stringify(requests[0])).toContain("src/app.ts")
  expect(JSON.stringify(requests[0])).not.toContain(".env")
  expect(JSON.stringify(requests[0])).not.toContain(".secret")
  await setup.mockInput.typeText("/idea 1")
  setup.mockInput.pressEscape()
  setup.mockInput.pressEnter()
  await setup.waitFor(() =>
    setup.renderer.currentFocusedRenderable instanceof TextareaRenderable &&
    setup.renderer.currentFocusedRenderable.plainText === "Improve the app",
  )
})

test("parallel task dashboard shows running and completed jobs", async () => {
  await using setup = await createAppFixture({
    fetch: async (url) => {
      if (url.pathname === "/api/rpc/bolt.process/list")
        return json({ output: [
          { id: "ses_child", type: "subagent", title: "Review changes", status: "running", started_at: 1 },
          { id: "shell_done", type: "shell", title: "Run tests", status: "completed", started_at: 2, output: "Tests passed" },
        ] })
    },
  })
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("Parallel tasks") && setup.renderer.currentFocusedRenderable instanceof TextareaRenderable)
  const editor = setup.renderer.currentFocusedRenderable
  if (!(editor instanceof TextareaRenderable)) throw new Error("Expected a focused prompt")
  editor.setText("")
  await setup.mockInput.typeText("/tasks")
  setup.mockInput.pressEscape()
  setup.mockInput.pressEnter()
  await setup.waitForFrame((frame) => frame.includes("Review changes") && frame.includes("Run tests"))
  expect(setup.captureCharFrame()).toContain("1 running")
})

async function waitForFrame(setup: Awaited<ReturnType<typeof createAppFixture>>, matches: (frame: string) => boolean) {
  const started = Date.now()
  while (!matches(setup.captureCharFrame())) {
    if (Date.now() - started > 2_000) throw new Error("Timed out waiting for command selection frame")
    await Bun.sleep(10)
  }
}
