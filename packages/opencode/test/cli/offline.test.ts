import { afterAll, describe, expect, test } from "bun:test"
import { Offline } from "../../src/cli/offline"

describe("offline mode", () => {
  test("classifies local destinations", () => {
    expect(Offline.local(new URL("http://localhost:4096/health"))).toBe(true)
    expect(Offline.local(new URL("http://127.0.0.1:3000"))).toBe(true)
    expect(Offline.local(new URL("http://opencode.internal/session"))).toBe(true)
    expect(Offline.local(new URL("http://[::1]:8080"))).toBe(true)
    expect(Offline.local(new URL("https://api.openai.com/v1/responses"))).toBe(false)
    expect(Offline.local(new URL("https://models.opencode.ai"))).toBe(false)
  })

  test("rejection message names the host and the flag", () => {
    const error = Offline.reject(new URL("https://api.anthropic.com/v1/messages"))
    expect(error.message).toContain("api.anthropic.com")
    expect(error.message).toContain("--offline")
  })

  describe("fetch guard", () => {
    const disable = Offline.enable()
    afterAll(() => disable())

    test("blocks remote requests immediately", async () => {
      const start = performance.now()
      expect(fetch("https://example.com")).rejects.toThrow("offline mode")
      expect(performance.now() - start).toBeLessThan(100)
    })

    test("allows loopback requests", async () => {
      const server = Bun.serve({
        port: 0,
        fetch() {
          return Response.json({ ok: true })
        },
      })
      const response = await fetch(`http://127.0.0.1:${server.port}`)
      expect(await response.json()).toEqual({ ok: true })
      await server.stop(true)
    })
  })
})
