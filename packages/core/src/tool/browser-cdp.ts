import { Schema } from "effect"

const Message = Schema.Struct({
  id: Schema.optionalKey(Schema.Number),
  result: Schema.optionalKey(Schema.Unknown),
  error: Schema.optionalKey(Schema.Struct({ message: Schema.String })),
  method: Schema.optionalKey(Schema.String),
  sessionId: Schema.optionalKey(Schema.String),
})
const decode = Schema.decodeUnknownSync(Message)
const targetResult = Schema.decodeUnknownSync(Schema.Struct({ targetId: Schema.String }))
const sessionResult = Schema.decodeUnknownSync(Schema.Struct({ sessionId: Schema.String }))
const htmlResult = Schema.decodeUnknownSync(Schema.Struct({ result: Schema.Struct({ value: Schema.String }) }))
const imageResult = Schema.decodeUnknownSync(
  Schema.Struct({ data: Schema.String.check(Schema.isMaxLength(24 * 1024 * 1024)) }),
)

/** Control one newly launched, capture-private browser; never discover or reuse a user's browser. */
export async function capture(input: {
  endpoint: string
  url: string
  action: "text" | "screenshot"
  width: number
  height: number
  signal: AbortSignal
}): Promise<{ html?: string; png?: Uint8Array }> {
  const endpoint = new URL(input.endpoint)
  if (
    endpoint.protocol !== "ws:" ||
    endpoint.hostname !== "127.0.0.1" ||
    !endpoint.port ||
    !endpoint.pathname.startsWith("/devtools/browser/")
  )
    throw new Error("Browser returned an invalid private DevTools endpoint")
  if (input.signal.aborted) throw new Error("Browser capture cancelled")
  const socket = new WebSocket(endpoint.href)
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>()
  const listeners = new Map<string, Set<{ resolve(): void; reject(error: Error): void }>>()
  let sequence = 0
  let closed = false
  const fail = (error: Error) => {
    if (closed) return
    closed = true
    for (const request of pending.values()) request.reject(error)
    pending.clear()
    for (const entries of listeners.values()) for (const entry of entries) entry.reject(error)
    listeners.clear()
    socket.close()
  }
  const abort = () => fail(new Error("Browser capture cancelled"))
  input.signal.addEventListener("abort", abort, { once: true })
  const opened = new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true })
    socket.addEventListener("error", () => reject(new Error("Could not connect to private browser")), { once: true })
    socket.addEventListener("close", () => reject(new Error("Private browser closed before connecting")), {
      once: true,
    })
  })
  socket.addEventListener("close", () => fail(new Error("Private browser connection closed")))
  socket.addEventListener("error", () => fail(new Error("Private browser connection failed")))
  socket.addEventListener("message", (event) => {
    try {
      if (typeof event.data !== "string" || event.data.length > 32 * 1024 * 1024)
        throw new Error("Browser response exceeds 32 MiB")
      const message = decode(JSON.parse(event.data))
      if (message.id !== undefined) {
        const request = pending.get(message.id)
        if (!request) return
        pending.delete(message.id)
        if (message.error) request.reject(new Error(message.error.message))
        else request.resolve(message.result)
      } else if (message.method) {
        const key = `${message.sessionId ?? ""}:${message.method}`
        const entries = listeners.get(key)
        if (!entries) return
        listeners.delete(key)
        entries.forEach((entry) => entry.resolve())
      }
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)))
    }
  })
  const send = (method: string, params: Record<string, unknown> = {}, sessionId?: string) =>
    new Promise<unknown>((resolve, reject) => {
      if (closed || socket.readyState !== WebSocket.OPEN) {
        reject(new Error("Private browser is closed"))
        return
      }
      const id = ++sequence
      pending.set(id, { resolve, reject })
      try {
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
      } catch (error) {
        pending.delete(id)
        reject(error)
      }
    })
  const event = (method: string, session: string) =>
    new Promise<void>((resolve, reject) => {
      if (closed) {
        reject(new Error("Private browser is closed"))
        return
      }
      const key = `${session}:${method}`
      const entries = listeners.get(key) ?? new Set()
      entries.add({ resolve, reject })
      listeners.set(key, entries)
    })
  try {
    await opened
    if (closed) throw new Error("Browser capture cancelled")
    const { targetId } = targetResult(await send("Target.createTarget", { url: "about:blank" }))
    const { sessionId } = sessionResult(await send("Target.attachToTarget", { targetId, flatten: true }))
    await send("Page.enable", {}, sessionId)
    await send(
      "Emulation.setDeviceMetricsOverride",
      { width: input.width, height: input.height, deviceScaleFactor: 1, mobile: false },
      sessionId,
    )
    const navigation = Schema.decodeUnknownSync(Schema.Struct({ errorText: Schema.optionalKey(Schema.String) }))
    await Promise.all([
      send("Page.navigate", { url: input.url }, sessionId).then((result) => {
        const value = navigation(result)
        if (value.errorText) throw new Error(`Browser navigation failed: ${value.errorText}`)
      }),
      event("Page.loadEventFired", sessionId),
    ])
    await Promise.all([
      send(
        "Emulation.setVirtualTimePolicy",
        { policy: "pauseIfNetworkFetchesPending", budget: 5000, maxVirtualTimeTaskStarvationCount: 100 },
        sessionId,
      ),
      event("Emulation.virtualTimeBudgetExpired", sessionId),
    ])
    if (input.action === "text") {
      const result = htmlResult(
        await send(
          "Runtime.evaluate",
          { expression: "document.documentElement.outerHTML", returnByValue: true },
          sessionId,
        ),
      )
      if (result.result.value.length > 16 * 1024 * 1024)
        throw new Error("Rendered page exceeds the 16 MiB capture limit")
      return { html: result.result.value }
    }
    const { data } = imageResult(
      await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId),
    )
    if (data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data))
      throw new Error("Browser returned invalid PNG data")
    const png = Buffer.from(data, "base64")
    if (png.byteLength > 16 * 1024 * 1024) throw new Error("Screenshot exceeds the 16 MiB capture limit")
    return { png }
  } finally {
    if (!closed && socket.readyState === WebSocket.OPEN) {
      let timer: ReturnType<typeof setTimeout> | undefined
      await Promise.race([
        send("Browser.close").catch(() => {}),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 1000)
        }),
      ])
      clearTimeout(timer)
    }
    input.signal.removeEventListener("abort", abort)
    fail(new Error("Browser capture finished"))
  }
}
