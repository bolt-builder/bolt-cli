// Minimal stopgap client for the Bolt server HTTP API.
//
// The repo's SDK packages (@opencode-ai/sdk and @opencode-ai/client) resolve
// their dependencies through the root workspace catalog and workspace:
// protocols, which this standalone extension package (own lockfile, not a
// workspace member) cannot consume; the generated Effect client would also
// pull the whole effect runtime into the extension bundle. Replace this
// module with the published SDK once one exists. It implements exactly what
// the sidebar needs: health, session create, prompt, interrupt, and the
// session event stream.

export type Event = {
  id: string
  type: string
  data: Record<string, unknown>
  durable?: { aggregateID: string; seq: number; version: number }
}

export function client(base: string, password?: string) {
  const auth: Record<string, string> = password
    ? { Authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` }
    : {}

  async function request(method: string, route: string, body?: unknown) {
    const response = await fetch(new URL(route, base), {
      method,
      headers: body === undefined ? auth : { ...auth, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(`${method} ${route} failed with status ${response.status}`)
    }
    if (response.status === 204) {
      return undefined
    }
    return response.json()
  }

  return {
    health: () => request("GET", "/api/health"),

    create: async () => {
      const result = (await request("POST", "/api/session", {})) as { data: { id: string } }
      return result.data
    },

    prompt: (session: string, text: string) =>
      request("POST", `/api/session/${session}/prompt`, { prompt: { text } }),

    interrupt: (session: string) => request("POST", `/api/session/${session}/interrupt`),

    // Subscribes to the session's SSE event stream and invokes the handler
    // for every event until the stream ends or the signal aborts.
    events: async (session: string, after: number | undefined, signal: AbortSignal, handler: (event: Event) => void) => {
      const url = new URL(`/api/session/${session}/event`, base)
      if (after !== undefined) {
        url.searchParams.set("after", String(after))
      }
      const response = await fetch(url, { headers: { ...auth, Accept: "text/event-stream" }, signal })
      if (!response.ok || !response.body) {
        throw new Error(`event stream failed with status ${response.status}`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) {
          return
        }
        buffer += decoder.decode(chunk.value, { stream: true })
        const blocks = buffer.split("\n\n")
        buffer = blocks.pop() ?? ""
        for (const block of blocks) {
          const data = block
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n")
          if (!data) {
            continue
          }
          handler(JSON.parse(data) as Event)
        }
      }
    },
  }
}
