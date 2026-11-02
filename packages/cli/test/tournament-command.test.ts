import { expect, test } from "bun:test"
import { OpenCode } from "@opencode/client/promise"
import { tournament } from "../src/services/tournament"

test("V2 tournaments isolate arena locations, judge anonymous diffs, retain sessions and clean losers", async () => {
  const created: {
    id: string
    title: string
    agent: string
    model: { providerID: string; id: string; variant?: string }
    location: { directory: string }
    permissions: unknown[]
  }[] = []
  const prompts = new Map<string, string>()
  const removed: string[] = []
  const controllers = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const worktrees: string[] = []
  const diffs: string[] = []
  const encoder = new TextEncoder()
  let brokenJudge = false
  let failCandidates = false
  let cleanupFails = false
  const event = (type: string, data: unknown) =>
    encoder.encode(`data: ${JSON.stringify({ id: crypto.randomUUID(), created: 1, type, data })}\n\n`)
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/api/location")
        return Response.json({
          directory: "/project",
          project: { id: "project", directory: "/project", canonical: "/project" },
        })
      if (url.pathname === "/api/worktree" && request.method === "POST") {
        const body = await request.json()
        expect(body).toMatchObject({ projectID: "project", from: "/project" })
        const directory = `/worktrees/${worktrees.length + 1}`
        worktrees.push(directory)
        return Response.json({ directory })
      }
      if (url.pathname === "/api/worktree" && request.method === "DELETE") {
        const body = await request.json()
        removed.push(body.directory)
        return cleanupFails
          ? Response.json({ message: "cleanup failed" }, { status: 500 })
          : new Response(null, { status: 204 })
      }
      if (url.pathname === "/api/session" && request.method === "POST") {
        const body = await request.json()
        const id = `ses_race_${created.length + 1}`
        created.push({ ...body, id })
        return Response.json({ data: { id } })
      }
      if (url.pathname === "/api/event") {
        let current: ReadableStreamDefaultController<Uint8Array>
        return new Response(
          new ReadableStream({
            start(controller) {
              current = controller
              controllers.add(controller)
              controller.enqueue(event("server.connected", {}))
            },
            cancel() {
              controllers.delete(current)
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        )
      }
      const id = /^\/api\/session\/([^/]+)/.exec(url.pathname)?.[1]
      if (id && url.pathname.endsWith("/prompt")) {
        const body = await request.json()
        prompts.set(id, body.text)
        const candidate = created.find((item) => item.id === id)!
        for (const controller of controllers)
          controller.enqueue(
            event(
              failCandidates && candidate.agent !== "ask" ? "session.execution.failed" : "session.execution.succeeded",
              { sessionID: id, error: { message: "provider failed" } },
            ),
          )
        return Response.json({ data: {} })
      }
      if (id && url.pathname.endsWith("/message")) {
        const candidate = created.find((item) => item.id === id)!
        const text =
          candidate.agent === "ask"
            ? brokenJudge
              ? "undecided"
              : "RANKING: B > A"
            : `answer from ${candidate.model.id}`
        return Response.json({ data: [{ type: "assistant", content: [{ type: "text", text }] }], cursor: {} })
      }
      if (url.pathname === "/api/vcs/diff") {
        const directory = url.searchParams.get("location[directory]")!
        diffs.push(directory)
        return Response.json({
          data: [{ file: "answer.ts", patch: `+fixed ${directory}`, additions: 1, deletions: 0, status: "modified" }],
        })
      }
      throw new Error(`Unexpected request ${request.method} ${url.pathname}`)
    },
  })
  try {
    const client = OpenCode.make({ baseUrl: server.url.toString() })
    const best = await tournament({
      client,
      models: "p/first#low,p/second",
      judge: "judge/rank",
      variant: "high",
      message: "solve the task",
      directory: "/project",
    })
    expect(best.winner?.model).toBe("p/second")
    expect(best.ranking).toEqual(["B", "A"])
    expect(
      created
        .slice(0, 2)
        .map((item) => item.model)
        .toSorted((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([
      { providerID: "p", id: "first", variant: "high" },
      { providerID: "p", id: "second", variant: "high" },
    ])
    expect(created[2].model).toEqual({ providerID: "judge", id: "rank" })
    expect(created[2].permissions).toContainEqual({ action: "*", resource: "*", effect: "deny" })
    expect(prompts.get(created[2].id)).not.toContain("p/first")
    const arena = await tournament({
      client,
      models: "p/same,p/same",
      message: "fix it",
      directory: "/project",
      arena: true,
      cleanup: true,
    })
    expect(arena.winner?.label).toBe("B")
    expect(
      created
        .slice(3, 5)
        .map((item) => item.location.directory)
        .toSorted(),
    ).toEqual(["/worktrees/1", "/worktrees/2"])
    expect(diffs.toSorted()).toEqual(["/worktrees/1", "/worktrees/2"])
    expect(prompts.get(created[5].id)).toContain("+fixed /worktrees/1")
    expect(removed).toEqual([arena.candidates[0].worktree!.directory])
    expect(arena.cleanupFailed).toBe(false)
    brokenJudge = true
    const fallback = await tournament({ client, models: "p/one,p/two", message: "answer", directory: "/project" })
    expect(fallback.ranking).toEqual(["A", "B"])
    cleanupFails = true
    const cleanup = await tournament({
      client,
      models: "p/one,p/two",
      message: "answer",
      directory: "/project",
      arena: true,
      cleanup: true,
    })
    expect(cleanup.cleanupFailed).toBe(true)
    failCandidates = true
    const failed = await tournament({ client, models: "p/one,p/two", message: "answer", directory: "/project" })
    expect(failed.winner).toBeUndefined()
    expect(failed.candidates.every((item) => item.error?.includes("provider failed"))).toBe(true)
  } finally {
    await server.stop(true)
  }
})
