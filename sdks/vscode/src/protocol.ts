// Typed message protocol between the extension host and the chat webview.
// Every message carries v: 1 so future shape changes are detectable on both
// sides. Upward messages travel webview to host, downward messages host to
// webview.

export type Up =
  | { v: 1; type: "ready" }
  | { v: 1; type: "prompt"; text: string }
  | { v: 1; type: "stop" }
  | { v: 1; type: "newSession" }

export type State = {
  backend: "starting" | "connected" | "error"
  streaming: boolean
  model?: string
}

export type Message = { role: "user" | "assistant"; text: string }

export type Down =
  | { v: 1; type: "token"; text: string }
  | { v: 1; type: "state"; state: State }
  | { v: 1; type: "error"; message: string }
  | { v: 1; type: "hydrate"; messages: Message[]; state: State }
  | { v: 1; type: "insert"; text: string }

// Narrows an untrusted value posted by the webview to an upward message.
export function up(value: unknown): Up | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined
  }
  const record = value as Record<string, unknown>
  if (record["v"] !== 1) {
    return undefined
  }
  if (record["type"] === "ready" || record["type"] === "stop" || record["type"] === "newSession") {
    return { v: 1, type: record["type"] }
  }
  if (record["type"] === "prompt" && typeof record["text"] === "string") {
    return { v: 1, type: "prompt", text: record["text"] }
  }
  return undefined
}

// Narrows an untrusted value posted by the host to a downward message.
export function down(value: unknown): Down | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined
  }
  const record = value as Record<string, unknown>
  if (record["v"] !== 1 || typeof record["type"] !== "string") {
    return undefined
  }
  return value as Down
}
