// The stable REST contract for driving bolt from scripts and external tools.
//
// Everything under /api is served by the existing bolt server (`bolt serve`).
// This module pins the subset we commit to keeping stable (sessions, prompts,
// events) behind an explicit version number so integrators have a single
// machine-readable source of truth: `bolt serve --api` prints it as JSON.
// The full generated OpenAPI document stays available at GET /doc.
//
// Bumping VERSION is required when any route listed here changes shape or
// moves; additions are backward compatible. A test asserts every route below
// exists in the real API definition, so this file cannot drift silently.

export const VERSION = 1

export type Route = {
  readonly name: string
  readonly method: "get" | "post"
  readonly path: string
  readonly describe: string
}

export const ROUTES: Route[] = [
  { name: "health", method: "get", path: "/api/health", describe: "server liveness probe" },
  { name: "session.list", method: "get", path: "/api/session", describe: "list sessions" },
  { name: "session.create", method: "post", path: "/api/session", describe: "create a session" },
  { name: "session.get", method: "get", path: "/api/session/{sessionID}", describe: "get one session" },
  {
    name: "session.prompt",
    method: "post",
    path: "/api/session/{sessionID}/prompt",
    describe: "send a prompt to a session",
  },
  {
    name: "session.messages",
    method: "get",
    path: "/api/session/{sessionID}/message",
    describe: "list session messages with cursor pagination",
  },
  {
    name: "session.interrupt",
    method: "post",
    path: "/api/session/{sessionID}/interrupt",
    describe: "interrupt the running session",
  },
  {
    name: "session.events",
    method: "get",
    path: "/api/session/{sessionID}/event",
    describe: "per-session event stream (SSE)",
  },
  { name: "event.subscribe", method: "get", path: "/api/event", describe: "global event stream (SSE)" },
]

/** Build the machine-readable surface descriptor printed by `bolt serve --api`. */
export function surface(base: string) {
  const origin = base.replace(/\/$/, "")
  return {
    version: VERSION,
    base: origin,
    openapi: `${origin}/doc`,
    auth: "HTTP basic auth when OPENCODE_SERVER_PASSWORD is set; unauthenticated on loopback otherwise",
    routes: ROUTES.map((route) => ({
      name: route.name,
      method: route.method,
      path: route.path,
      describe: route.describe,
      url: origin + route.path,
    })),
  }
}

export * as Surface from "./surface"
