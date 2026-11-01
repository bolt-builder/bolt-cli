import { describe, expect, test } from "bun:test"
import http from "node:http"
import https from "node:https"
import net from "node:net"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { gzipSync } from "node:zlib"
import { NetGuard } from "@opencode/core/net-guard"
import { proxyFor } from "../src/net-guard.node"
import { Effect } from "effect"

async function makeProxy() {
  const connects: string[] = []
  const proxy = http.createServer()
  proxy.on("connect", (request, client, head) => {
    const authority = request.url ?? ""
    connects.push(authority)
    const match = authority.match(/^(\[[^\]]+\]|[^:]+):(\d+)$/)
    if (!match) return client.destroy()
    const host = match[1].replace(/^\[|\]$/g, "")
    if (!net.isIP(host)) return client.destroy()
    const upstream = net.connect(Number(match[2]), host, () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n")
      if (head.length) upstream.write(head)
      client.pipe(upstream).pipe(client)
    })
    upstream.on("error", () => client.destroy())
    client.on("error", () => upstream.destroy())
  })
  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve))
  const address = proxy.address()
  if (!address || typeof address === "string") throw new Error("Expected proxy listener")
  return { proxy, connects, url: `http://127.0.0.1:${address.port}` }
}

async function run(url: string, mode: string, extra: Record<string, string> = {}) {
  const child = Bun.spawn([process.execPath, path.join(import.meta.dir, "fixture/net-guard-rebinding.ts"), url, mode], {
    env: {
      ...process.env,
      http_proxy: "",
      https_proxy: "",
      all_proxy: "",
      no_proxy: "",
      ...extra,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  expect(code, stderr).toBe(0)
  return JSON.parse(stdout)
}

describe("pinned fetch transport", () => {
  test("connects only to the validated resolution, preserves Host, and rejects mixed DNS answers", async () => {
    const hosts: string[] = []
    const server = http.createServer((request, response) => {
      hosts.push(request.headers.host ?? "")
      response.end("fixture")
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Expected IP listener")
    try {
      const url = `http://rebinding.test:${address.port}/fixture`
      expect(await run(url, "rebind")).toEqual({ calls: 1, status: 200, text: "fixture" })
      expect(hosts).toEqual([`rebinding.test:${address.port}`])
      expect((await run(url, "mixed")).error).toContain("link-local")
      expect(hosts).toHaveLength(1)
    } finally {
      server.close()
    }
  })

  test("rejects IPv4, IPv6 and mapped link-local addresses while permitting local development", async () => {
    for (const url of [
      "http://169.254.1.1/",
      "http://[fe80::1]/",
      "http://[::ffff:a9fe:101]/",
      "http://[fd00:ec2::254]/",
    ]) {
      await expect(NetGuard.makeFetch(undefined, {})(url)).rejects.toThrow("link-local")
    }
    await expect(NetGuard.makeFetch(async () => ["fd00:ec2::254"], {})("http://metadata.test/")).rejects.toThrow(
      "link-local",
    )
    await Effect.runPromise(NetGuard.assertFetchable(new URL("http://[fd00:ec2::255]/")))
    const server = http.createServer((_request, response) => response.end("local"))
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Expected IP listener")
    try {
      expect(await (await NetGuard.makeFetch(undefined, {})(`http://127.0.0.1:${address.port}`)).text()).toBe("local")
    } finally {
      server.close()
    }
  })

  test("uses a pinned address through the proxy and honors NO_PROXY", async () => {
    const hosts: string[] = []
    const server = http.createServer((request, response) => {
      hosts.push(request.headers.host ?? "")
      response.end("proxy fixture")
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Expected IP listener")
    const proxy = await makeProxy()
    const url = `http://fixture.test:${address.port}/path`
    try {
      const resolver = async () => ["127.0.0.1"]
      const through = NetGuard.makeFetch(resolver, { HTTP_PROXY: proxy.url, NO_PROXY: "different.test" })
      expect(await (await through(url)).text()).toBe("proxy fixture")
      expect(proxy.connects).toEqual([`127.0.0.1:${address.port}`])
      const bypass = NetGuard.makeFetch(resolver, { HTTP_PROXY: proxy.url, NO_PROXY: `fixture.test:${address.port}` })
      expect(await (await bypass(url)).text()).toBe("proxy fixture")
      expect(proxy.connects).toHaveLength(1)
      expect(hosts).toEqual([`fixture.test:${address.port}`, `fixture.test:${address.port}`])
      await expect(NetGuard.makeFetch(async () => ["169.254.169.254"], { HTTP_PROXY: proxy.url })(url)).rejects.toThrow(
        "link-local",
      )
      await expect(NetGuard.makeFetch(resolver, { HTTP_PROXY: "socks5://127.0.0.1:1080" })(url)).rejects.toThrow(
        "Unsupported proxy",
      )
      expect(proxy.connects).toHaveLength(1)
      expect(proxyFor(new URL("http://[::1]/"), { HTTP_PROXY: proxy.url, NO_PROXY: "localhost,::1" })).toBeUndefined()
      expect(proxyFor(new URL(url), { HTTP_PROXY: proxy.url, NO_PROXY: "*.test" })).toBeUndefined()
      expect(proxyFor(new URL(url), { HTTP_PROXY: proxy.url, NO_PROXY: ".fixture.test" })).toBeUndefined()
      expect(proxyFor(new URL(url), { HTTP_PROXY: proxy.url, NO_PROXY: "fixture.test:1" })).toBe(proxy.url)
    } finally {
      proxy.proxy.closeAllConnections()
      proxy.proxy.close()
      server.closeAllConnections()
      server.close()
    }
  })

  test("falls back from an unreachable IPv6 address to a validated IPv4 address", async () => {
    const server = http.createServer((_request, response) => response.end("fallback"))
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Expected IP listener")
    try {
      const fetch = NetGuard.makeFetch(async () => ["::1", "127.0.0.1"], {})
      expect(await (await fetch(`http://fixture.test:${address.port}`)).text()).toBe("fallback")
    } finally {
      server.close()
    }
  })

  test("does not connect if cancelled during DNS and aborts a streaming response", async () => {
    let hits = 0
    const server = http.createServer((_request, response) => {
      hits++
      response.writeHead(200, { "Content-Type": "text/plain" })
      response.write("partial")
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Expected IP listener")
    try {
      const controller = new AbortController()
      let finish: ((addresses: readonly string[]) => void) | undefined
      const pending = NetGuard.makeFetch(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
        {},
      )(`http://fixture.test:${address.port}`, { signal: controller.signal })
      controller.abort()
      finish?.(["127.0.0.1"])
      await expect(pending).rejects.toBeDefined()
      expect(hits).toBe(0)
      const streaming = new AbortController()
      const response = await NetGuard.makeFetch(undefined, {})(`http://127.0.0.1:${address.port}`, {
        signal: streaming.signal,
      })
      const body = response.text()
      streaming.abort()
      await expect(body).rejects.toBeDefined()
      expect(hits).toBe(1)
    } finally {
      server.closeAllConnections()
      server.close()
    }
  })

  test("decodes compressed responses even if a server ignores identity encoding", async () => {
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { "Content-Encoding": "gzip", "Content-Type": "text/plain" })
      response.end(gzipSync("compressed fixture"))
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Expected IP listener")
    try {
      expect(await (await NetGuard.makeFetch(undefined, {})(`http://127.0.0.1:${address.port}`)).text()).toBe(
        "compressed fixture",
      )
    } finally {
      server.close()
    }
  })

  test("uses the original TLS server name and validates its certificate", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-tls-"))
    const key = path.join(tmp, "key.pem")
    const cert = path.join(tmp, "cert.pem")
    const generate = Bun.spawn(
      [
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "1",
        "-subj",
        "/CN=rebinding.test",
        "-addext",
        "subjectAltName=DNS:rebinding.test",
      ],
      { stdout: "ignore", stderr: "ignore" },
    )
    expect(await generate.exited).toBe(0)
    const names: string[] = []
    const server = https.createServer(
      { key: await fs.readFile(key), cert: await fs.readFile(cert) },
      (request, response) => response.end(request.headers.host),
    )
    server.on("secureConnection", (socket) => names.push(socket.servername || ""))
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Expected IP listener")
    const proxy = await makeProxy()
    try {
      const url = `https://rebinding.test:${address.port}/`
      expect(await run(url, "rebind", { NODE_EXTRA_CA_CERTS: cert })).toEqual({
        calls: 1,
        status: 200,
        text: `rebinding.test:${address.port}`,
      })
      expect(names).toEqual(["rebinding.test"])
      const invalid = await run(`https://wrong.test:${address.port}/`, "rebind", { NODE_EXTRA_CA_CERTS: cert })
      expect(invalid.error).toBeDefined()
      const proxied = await run(url, "rebind", { NODE_EXTRA_CA_CERTS: cert, https_proxy: proxy.url, no_proxy: "" })
      expect(proxied).toEqual({ calls: 1, status: 200, text: `rebinding.test:${address.port}` })
      expect(proxy.connects).toEqual([`127.0.0.1:${address.port}`])
      expect(names.at(-1)).toBe("rebinding.test")
      const badProxyName = await run(`https://wrong.test:${address.port}/`, "rebind", {
        NODE_EXTRA_CA_CERTS: cert,
        https_proxy: proxy.url,
        no_proxy: "",
      })
      expect(badProxyName.error).toBeDefined()
    } finally {
      proxy.proxy.closeAllConnections()
      proxy.proxy.close()
      server.close()
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })
})
