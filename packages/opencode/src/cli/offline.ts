export * as Offline from "./offline"

// Offline mode (--offline): instead of letting network calls hang until their
// own timeouts, every non-local fetch fails immediately with a clear message.
// Loopback and in-process destinations stay allowed so local servers, the
// daemon, and the internal fetch bridge keep working.

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0", "opencode.internal"])

export function local(url: URL) {
  return LOCAL.has(url.hostname)
}

export function reject(url: URL) {
  return new Error(
    `offline mode: refusing network request to ${url.host} (bolt was started with --offline; remove the flag to allow network access)`,
  )
}

export function enable() {
  const original = globalThis.fetch
  const guard = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (local(url)) return original(input as never, init)
    throw reject(url)
  }) as typeof globalThis.fetch
  globalThis.fetch = guard
  return () => {
    globalThis.fetch = original
  }
}
