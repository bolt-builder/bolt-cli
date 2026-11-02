import { expect, test } from "bun:test"
import { createAppFixture } from "./fixture/app"
import { directory, json } from "./fixture/tui-client"
import { takeDraft } from "../src/component/prompt/draft-stash"

const sessions = ["current", "previous", "older"].map((name, index) => ({
  id: `ses_history_${name}`,
  title: `${name} conversation`,
  projectID: "project",
  location: { directory },
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: { created: 1, updated: 3 - index },
}))

test("session sidebar loads history beyond open tabs, pages older records and opens them", async () => {
  takeDraft(undefined)
  const requests: URL[] = []
  await using setup = await createAppFixture({
    width: 160,
    height: 45,
    args: { sessionID: sessions[0].id },
    config: { animations: false, tabs: { mode: "on" } },
    fetch(url) {
      if (url.pathname === "/api/session") {
        requests.push(url)
        return json({
          data: url.searchParams.has("cursor") ? sessions.slice(2) : sessions.slice(0, 2),
          cursor: url.searchParams.has("cursor") ? {} : { next: "older" },
        })
      }
      const found = sessions.find((session) => url.pathname === `/api/session/${session.id}`)
      if (found) return json({ data: found })
      if (/^\/api\/session\/ses_history_\w+\/(message|inbox|permission)$/.test(url.pathname))
        return json({ data: [], cursor: {} })
    },
  })
  await setup.ready
  await setup.waitForFrame((frame) => frame.includes("previous conversation") && frame.includes("Load older sessions"))
  const more = setup.renderer.root.findDescendantById("sidebar-sessions-more")!
  await setup.mockMouse.click(more.x + 1, more.y)
  await setup.waitForFrame((frame) => frame.includes("older conversation"))
  expect(requests.some((url) => url.searchParams.get("cursor") === "older" && !url.searchParams.has("order"))).toBe(
    true,
  )
  const older = setup.renderer.root.findDescendantById(`sidebar-session-${sessions[2].id}`)!
  await setup.mockMouse.click(older.x + 3, older.y)
  await setup.waitForFrame((frame) => frame.includes("› older conversation"))
  setup.events.emit({
    id: "evt_delete_previous",
    created: 5,
    type: "session.deleted",
    data: { sessionID: sessions[1].id },
    durable: { aggregateID: sessions[1].id, seq: 1, version: 2 },
  })
  await setup.waitFor(() => !setup.renderer.root.findDescendantById(`sidebar-session-${sessions[1].id}`))
})

for (const confirmation of ["cancel", "DELETE"]) {
  test(`clear-data snapshots paginated history and requires explicit confirmation: ${confirmation}`, async () => {
    takeDraft(undefined)
    const deleted: string[] = []
    const requests: URL[] = []
    await using setup = await createAppFixture({
      config: { animations: false, keybinds: { "session.history.clear": "f6" } },
      fetch(url, request) {
        if (url.pathname === "/api/session") {
          requests.push(url)
          return json({
            data: url.searchParams.has("cursor") ? sessions.slice(1) : sessions.slice(0, 1),
            cursor: url.searchParams.has("cursor") ? {} : { next: "page2" },
          })
        }
        if (request.method === "DELETE" && url.pathname.startsWith("/api/session/")) {
          deleted.push(url.pathname.split("/").at(-1)!)
          return deleted.length === 2
            ? new Response("Unavailable", { status: 503 })
            : new Response(null, { status: 204 })
        }
      },
    })
    await setup.ready
    await setup.waitForFrame((frame) => frame.includes("commands"))
    setup.mockInput.pressKey("F6")
    await setup.waitForFrame((frame) => frame.includes("Type DELETE to confirm"))
    expect(deleted).toEqual([])
    expect(setup.captureCharFrame()).toContain("3 conversations")
    expect(setup.captureCharFrame()).toContain("reset Zen")
    expect(setup.captureCharFrame()).toContain("usage limits.")
    if (confirmation === "cancel") setup.mockInput.pressEscape()
    if (confirmation === "DELETE") {
      await setup.mockInput.typeText(confirmation)
      setup.mockInput.pressEnter()
      await setup.waitForFrame((frame) => frame.includes("Deleted 2 conversations; 1 could not be deleted"))
    }
    await setup.renderOnce()
    expect(deleted).toEqual(confirmation === "DELETE" ? sessions.map((session) => session.id) : [])
    expect(requests.some((url) => url.searchParams.get("cursor") === "page2" && !url.searchParams.has("order"))).toBe(
      true,
    )
    expect(setup.config()).toMatchObject({ animations: false })
  })
}
