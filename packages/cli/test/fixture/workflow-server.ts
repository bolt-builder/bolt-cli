import { expect } from "bun:test"

/** Synthetic V2 transport; commands run their real HTTP client and subprocesses. */
export function workflowServer(
  reply: (input: { id: string; agent: string; text: string; prompts: string[] }) => Promise<string>,
) {
  const streams = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const sessions = new Map<string, { agent: string; prompts: string[]; answer: string; permissions: unknown }>()
  const removed: string[] = []
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/api/info") return Response.json({ version: "local" })
      if (url.pathname === "/api/event")
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streams.add(controller)
              controller.enqueue(new TextEncoder().encode('data: {"type":"server.connected","data":{}}\n\n'))
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        )
      if (url.pathname === "/api/session" && request.method === "POST") {
        const input = await request.json()
        expect(input.permissions).toEqual(
          expect.arrayContaining([{ action: "question", resource: "*", effect: "deny" }]),
        )
        const id = `ses_workflow_${sessions.size + 1}`
        sessions.set(id, { agent: input.agent, prompts: [], answer: "", permissions: input.permissions })
        return Response.json({ data: { id } })
      }
      const id = /^\/api\/session\/([^/]+)/.exec(url.pathname)?.[1]!
      const session = sessions.get(id)
      if (url.pathname === `/api/session/${id}` && request.method === "GET") return Response.json({ data: { id } })
      if (url.pathname === `/api/session/${id}` && request.method === "DELETE") {
        removed.push(id)
        return new Response(null, { status: 204 })
      }
      if (url.pathname === `/api/session/${id}/prompt`) {
        const input = await request.json()
        session!.prompts.push(input.text)
        session!.answer = await reply({ id, agent: session!.agent, text: input.text, prompts: session!.prompts })
        for (const controller of streams) {
          try {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: "session.execution.succeeded", data: { sessionID: id } })}\n\n`,
              ),
            )
          } catch {
            streams.delete(controller)
          }
        }
        return Response.json({ data: { id: "msg_fixture" } })
      }
      if (url.pathname === `/api/session/${id}/message`)
        return Response.json({
          data: [{ id: "msg_answer", type: "assistant", content: [{ type: "text", text: session!.answer }] }],
          cursor: {},
        })
      if (url.pathname.endsWith("/interrupt")) return new Response(null, { status: 204 })
      return new Response("Unexpected workflow request", { status: 404 })
    },
  })
  return { server, sessions, removed }
}
