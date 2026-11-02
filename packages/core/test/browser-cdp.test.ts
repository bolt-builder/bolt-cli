import { expect, test } from "bun:test"
import { capture } from "@opencode/core/tool/browser-cdp"

async function fixture(mode: "error" | "pending" | "invalid-image" | "invalid-json") {
  const methods: string[] = []
  const navigating = Promise.withResolvers<void>()
  const closed = Promise.withResolvers<void>()
  const server = Bun.serve<{ fixture: boolean }>({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request, server) {
      if (server.upgrade(request, { data: { fixture: true } })) return
      return new Response("upgrade required", { status: 400 })
    },
    websocket: {
      message(socket, raw) {
        const request = JSON.parse(String(raw))
        methods.push(request.method)
        if (mode === "invalid-json") {
          socket.send("{broken")
          return
        }
        const result =
          request.method === "Target.createTarget"
            ? { targetId: "page" }
            : request.method === "Target.attachToTarget"
              ? { sessionId: "page-session" }
              : request.method === "Page.captureScreenshot"
                ? { data: "bad!base64" }
                : request.method === "Page.navigate" && mode === "error"
                  ? { errorText: "net::ERR_CONNECTION_REFUSED" }
                  : {}
        socket.send(JSON.stringify({ id: request.id, result }))
        if (request.method === "Page.navigate") {
          navigating.resolve()
          if (mode === "invalid-image")
            socket.send(JSON.stringify({ sessionId: "page-session", method: "Page.loadEventFired" }))
        }
        if (request.method === "Emulation.setVirtualTimePolicy")
          socket.send(JSON.stringify({ sessionId: "page-session", method: "Emulation.virtualTimeBudgetExpired" }))
        if (request.method === "Browser.close") socket.close()
      },
      close() {
        closed.resolve()
      },
    },
  })
  return {
    endpoint: `ws://127.0.0.1:${server.port}/devtools/browser/fixture`,
    methods,
    navigating: navigating.promise,
    closed: closed.promise,
    close: () => server.stop(true),
  }
}
const input = { url: "http://localhost:3000/", action: "screenshot" as const, width: 640, height: 480 }

test("CDP capture rejects endpoints outside its own loopback browser", async () => {
  for (const endpoint of [
    "ws://localhost:9000/devtools/browser/x",
    "ws://169.254.169.254/devtools/browser/x",
    "wss://127.0.0.1:9000/devtools/browser/x",
    "ws://127.0.0.1:9000/other",
  ])
    await expect(capture({ ...input, endpoint, signal: new AbortController().signal })).rejects.toThrow(
      "invalid private DevTools endpoint",
    )
})
test("failed navigation closes the private browser without evaluating or capturing the error page", async () => {
  const browser = await fixture("error")
  try {
    await expect(
      capture({ ...input, endpoint: browser.endpoint, signal: new AbortController().signal }),
    ).rejects.toThrow("net::ERR_CONNECTION_REFUSED")
    expect(browser.methods).toContain("Browser.close")
    expect(browser.methods).not.toContain("Runtime.evaluate")
    expect(browser.methods).not.toContain("Page.captureScreenshot")
  } finally {
    await browser.close()
  }
})
test("cancellation closes a pending navigation and its event waiter", async () => {
  const browser = await fixture("pending")
  const controller = new AbortController()
  try {
    const result = capture({ ...input, endpoint: browser.endpoint, signal: controller.signal })
    const settled = result.then(
      () => ({ error: undefined }),
      (error: unknown) => ({ error }),
    )
    await browser.navigating
    controller.abort()
    expect((await settled).error).toBeInstanceOf(Error)
    expect(String((await settled).error)).toContain("cancelled")
    await browser.closed
    expect(browser.methods).not.toContain("Page.captureScreenshot")
  } finally {
    await browser.close()
  }
})
test("malformed protocol and screenshot payloads are rejected", async () => {
  for (const mode of ["invalid-image", "invalid-json"] as const) {
    const browser = await fixture(mode)
    try {
      await expect(
        capture({ ...input, endpoint: browser.endpoint, signal: new AbortController().signal }),
      ).rejects.toThrow()
      await browser.closed
    } finally {
      await browser.close()
    }
  }
})
