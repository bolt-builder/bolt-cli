import { expect, test } from "bun:test"
import { takeDraft } from "../src/component/prompt/draft-stash"
import { createAppFixture } from "./fixture/app"
import { directory, json } from "./fixture/tui-client"

for (const width of [44, 100]) {
  test(`Bolt session header and fire react to activity and preferences at ${width} columns`, async () => {
    takeDraft(undefined)
    const session = {
      id: "ses_fire",
      title: "Restore Bolt appearance",
      projectID: "project",
      location: { directory },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: 1, updated: 2 },
    }
    await using setup = await createAppFixture({
      width,
      height: 40,
      args: { sessionID: session.id },
      config: {
        animations: true,
        fire: true,
        session: { sidebar: "hide" },
        keybinds: { "app.toggle.fire": "f6", "app.toggle.animations": "f7" },
      },
      fetch: (url) => {
        if (url.pathname === `/api/session/${session.id}`) return json({ data: session })
        if (url.pathname === "/api/session") return json({ data: [session], cursor: {} })
        if (/^\/api\/session\/ses_fire\/(message|inbox|permission)$/.test(url.pathname))
          return json({ data: [], cursor: {} })
      },
    })
    await setup.ready
    await setup.waitForFrame((frame) => frame.includes("BOLT CLI") && frame.includes("no subagent work"))
    const fireHeight = () => setup.renderer.root.findDescendantById("bolt-fire")?.height ?? 0
    expect(fireHeight()).toBe(0)
    const status = (type: "session.execution.started" | "session.execution.succeeded", seq: number) =>
      setup.events.emit({
        type,
        data: { sessionID: session.id },
        id: `evt_fire_${seq}`,
        created: Date.now(),
        durable: { aggregateID: session.id, seq, version: 1 },
      })
    status("session.execution.started", 1)
    await setup.waitForFrame(() => fireHeight() === 16, { maxPasses: 150 })
    expect(setup.renderer.currentFocusedEditor?.height).toBeGreaterThan(0)
    setup.mockInput.pressKey("F6")
    await setup.waitForFrame(() => fireHeight() === 0)
    expect(setup.config().fire).toBe(false)
    setup.mockInput.pressKey("F6")
    await setup.waitForFrame(() => fireHeight() === 16, { maxPasses: 150 })
    setup.mockInput.pressKey("F7")
    await setup.waitForFrame(() => fireHeight() === 0)
    expect(setup.config().animations).toBe(false)
    setup.mockInput.pressKey("F7")
    await setup.waitForFrame(() => fireHeight() === 16, { maxPasses: 150 })
    status("session.execution.succeeded", 2)
    await setup.waitForFrame(() => fireHeight() === 0)
    setup.resize(width, 14)
    await setup.waitForFrame((frame) => !frame.includes("BOLT CLI"))
    status("session.execution.started", 3)
    await setup.renderOnce()
    expect(fireHeight()).toBe(0)
  })
}
