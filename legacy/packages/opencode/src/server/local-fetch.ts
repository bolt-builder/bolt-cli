export * as ServerLocalFetch from "./local-fetch"

import { ServerAuth } from "./auth"

// Routes requests to the in-process server, attaching auth; the Server
// import stays lazy so callers that never hit the server never load it.
export const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const { Server } = await import("@/server/server")
  const request = new Request(input, init)
  const headers = new Headers(request.headers)
  const auth = ServerAuth.header()
  if (auth) headers.set("Authorization", auth)
  return Server.Default().app.fetch(new Request(request, { headers }))
}) as typeof globalThis.fetch
