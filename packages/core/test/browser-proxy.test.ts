import { describe, expect, test } from "bun:test"
import http from "node:http"
import net from "node:net"
import { start } from "@opencode/core/tool/browser-proxy.node"
import { args, normalize } from "@opencode/core/tool/plugin/browser"
import { legacyCaptureRules } from "@opencode/core/permission/browser"
import { Permission } from "@opencode/core/permission"

async function origin() {
  const seen: string[] = []
  const server = http.createServer((request, response) => {
    seen.push(`${request.headers.host}${request.url}`)
    if (request.url === "/redirect") {
      response.writeHead(302, { location: "http://169.254.169.254/latest/meta-data" })
      response.end()
      return
    }
    response.end("render fixture")
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("No listener")
  return { port: address.port, seen, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}
function request(proxy: string, url: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: string; location?: string }>((resolve, reject) => {
    const value = http.request(proxy, { method: "GET", path: url, headers }, (result) => {
      let body = ""
      result.on("data", (chunk) => (body += chunk))
      result.once("end", () => resolve({ status: result.statusCode ?? 0, body, location: result.headers.location }))
    })
    value.once("error", reject)
    value.end()
  })
}
function connect(proxy: string, authority: string) {
  return new Promise<string>((resolve, reject) => {
    const url = new URL(proxy)
    const socket = net.connect(Number(url.port), url.hostname)
    let text = ""
    socket.setTimeout(2000, () => socket.destroy(new Error("CONNECT fixture timed out")))
    socket.once("connect", () => socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`))
    socket.on("data", (chunk) => {
      text += chunk.toString()
      if (!text.includes("\r\n\r\n")) return
      resolve(text)
      socket.destroy()
    })
    socket.once("error", reject)
  })
}

describe("headless capture network boundary", () => {
  test("pins HTTP and CONNECT to a checked IP without a second hostname resolution", async () => {
    const page = await origin()
    let calls = 0
    const proxy = await start(async (host) => {
      expect(host).toBe("rebinding.invalid")
      calls++
      return calls <= 2 ? ["127.0.0.1"] : ["169.254.169.254"]
    })
    try {
      expect(
        await request(proxy.url, `http://rebinding.invalid:${page.port}/page`, {
          "proxy-authorization": "local-fixture",
        }),
      ).toMatchObject({ status: 200, body: "render fixture" })
      expect(page.seen).toEqual([`rebinding.invalid:${page.port}/page`])
      expect(calls).toBe(1)
      expect(await connect(proxy.url, `rebinding.invalid:${page.port}`)).toContain("200 Connection Established")
      expect(calls).toBe(2)
      expect((await request(proxy.url, `http://rebinding.invalid:${page.port}/page`)).status).toBe(502)
      expect(calls).toBe(3)
      expect(page.seen).toHaveLength(1)
    } finally {
      await proxy.close()
      await page.close()
    }
  })
  test("blocks metadata addresses, mixed DNS answers, redirects and invalid schemes", async () => {
    const page = await origin()
    const proxy = await start(async () => ["127.0.0.1", "169.254.169.254"])
    try {
      for (const url of [
        "http://169.254.169.254/",
        "http://[fe80::1]/",
        "http://[fd00:ec2::254]/",
        "http://user:secret@127.0.0.1/",
        `http://mixed.invalid:${page.port}/`,
      ])
        expect((await request(proxy.url, url)).status).toBe(502)
      await expect(request(proxy.url, "file:///etc/passwd")).rejects.toMatchObject({ code: "ECONNRESET" })
      expect(await connect(proxy.url, "169.254.169.254:80")).toContain("502 Bad Gateway")
      const redirect = await request(proxy.url, `http://127.0.0.1:${page.port}/redirect`)
      expect(redirect.status).toBe(302)
      expect((await request(proxy.url, redirect.location!)).status).toBe(502)
      expect(page.seen).toHaveLength(1)
    } finally {
      await proxy.close()
      await page.close()
    }
  })
  test("closing a capture disposes live CONNECT sockets and is idempotent", async () => {
    const page = await origin()
    const proxy = await start()
    try {
      const url = new URL(proxy.url)
      const socket = net.connect(Number(url.port), url.hostname)
      await new Promise<void>((resolve) => socket.once("connect", resolve))
      socket.write(`CONNECT 127.0.0.1:${page.port} HTTP/1.1\r\nHost: 127.0.0.1:${page.port}\r\n\r\n`)
      await new Promise<void>((resolve) => socket.once("data", () => resolve()))
      const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()))
      socket.resume()
      await proxy.close()
      await closed
      expect(socket.destroyed).toBe(true)
      await proxy.close()
      await expect(request(proxy.url, "http://127.0.0.1/")).rejects.toBeDefined()
    } finally {
      await proxy.close()
      await page.close()
    }
  })
})

test("capture flags force HTTP(S) and loopback through the proxy and isolate the profile", () => {
  const value = args("text", "http://localhost:3000/", {
    width: 1280,
    height: 800,
    sandbox: true,
    proxy: "http://127.0.0.1:1111",
    profile: "/tmp/private profile",
  })
  expect(value).toContain("--proxy-bypass-list=<-loopback>")
  expect(value).toContain("--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1")
  expect(value).toContain("--force-webrtc-ip-handling-policy=disable_non_proxied_udp")
  expect(value).toContain("--user-data-dir=/tmp/private profile")
  expect(normalize("https://user:secret@example.com")).toBeUndefined()
})
test("legacy capture permission aliases preserve order and do not inherit desktop attachment denials", () => {
  const original: Permission.Rule[] = [
    { action: "*", resource: "*", effect: "allow" },
    { action: "browser", resource: "*", effect: "ask" },
    { action: "browser", resource: "https://blocked/*", effect: "deny" },
    { action: "browser_headless", resource: "https://explicit/*", effect: "deny" },
  ]
  const rules = legacyCaptureRules(original)
  rules.push({ action: "browser", resource: "*", effect: "deny" })
  expect(Permission.evaluate("browser_headless", "https://example/", rules).effect).toBe("ask")
  expect(Permission.evaluate("browser_headless", "https://blocked/path", rules).effect).toBe("deny")
  expect(Permission.evaluate("browser_headless", "https://explicit/path", rules).effect).toBe("deny")
  expect(Permission.evaluate("browser", "https://example/", rules).effect).toBe("deny")
  expect(original).toHaveLength(4)
})
