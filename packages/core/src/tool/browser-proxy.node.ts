import http, { type IncomingHttpHeaders } from "node:http"
import net, { type Socket } from "node:net"
import type { Duplex } from "node:stream"
import { NetGuard } from "../net-guard.js"

const MAX_CONNECTIONS = 64
const MAX_BYTES = 64 * 1024 * 1024

/** A capture-private loopback proxy. Every HTTP request and CONNECT resolves once to a checked IP. */
export async function start(resolver?: NetGuard.Resolver) {
  const sockets = new Set<Duplex>()
  let closed = false
  const track = <T extends Duplex>(socket: T): T => {
    sockets.add(socket)
    socket.on("error", () => socket.destroy())
    socket.once("close", () => sockets.delete(socket))
    return socket
  }
  const target = async (value: string, connect: boolean) => {
    const url = new URL(connect ? `https://${value}` : value)
    if (url.username || url.password || (connect ? url.protocol !== "https:" : url.protocol !== "http:"))
      throw new Error("Invalid browser proxy target")
    const addresses = await NetGuard.resolveAddresses(url, resolver)
    if (closed) throw new Error("Browser capture is closed")
    return { url, address: addresses[0], port: Number(url.port || (connect ? 443 : 80)) }
  }
  const server = http.createServer({ maxHeaderSize: 16_384 }, (incoming, response) => {
    void (async () => {
      const { url, address, port } = await target(incoming.url ?? "", false)
      if (incoming.destroyed || response.destroyed) return
      const outgoing = http.request(
        {
          hostname: address,
          port,
          family: net.isIP(address),
          method: incoming.method,
          path: `${url.pathname}${url.search}`,
          headers: { ...headers(incoming.headers), host: url.host },
          agent: false,
        },
        (result) => {
          response.writeHead(result.statusCode ?? 502, headers(result.headers))
          let bytes = 0
          result.on("data", (chunk: Buffer) => {
            bytes += chunk.byteLength
            if (bytes > MAX_BYTES) result.destroy(new Error("Browser resource exceeds 64 MiB"))
          })
          result.on("error", () => response.destroy())
          result.pipe(response)
        },
      )
      outgoing.on("socket", (socket: Socket) => track(socket))
      outgoing.on("error", () => {
        if (!response.headersSent) response.writeHead(502)
        response.end()
      })
      outgoing.setTimeout(30_000, () => outgoing.destroy())
      response.once("close", () => outgoing.destroy())
      incoming.once("aborted", () => outgoing.destroy())
      incoming.pipe(outgoing)
    })().catch(() => {
      if (!response.headersSent) response.writeHead(502)
      response.end()
    })
  })
  server.maxConnections = MAX_CONNECTIONS
  server.headersTimeout = 10_000
  server.requestTimeout = 30_000
  server.on("connection", (socket) => {
    track(socket)
    socket.setTimeout(30_000, () => socket.destroy())
  })
  server.on("clientError", (_error, socket) => socket.destroy())
  server.on("upgrade", (_request, socket) => socket.destroy())
  server.on("connect", (incoming, client, head) => {
    client.on("error", () => client.destroy())
    void (async () => {
      const { address, port } = await target(incoming.url ?? "", true)
      if (client.destroyed) return
      const upstream = track(net.createConnection({ host: address, port }))
      upstream.setTimeout(30_000, () => upstream.destroy())
      let bytes = head.byteLength
      const limit = (chunk: Buffer) => {
        bytes += chunk.byteLength
        if (bytes > MAX_BYTES) upstream.destroy()
      }
      upstream.on("data", limit)
      client.on("data", limit)
      client.once("close", () => upstream.destroy())
      upstream.once("close", () => client.destroy())
      upstream.once("connect", () => {
        if (client.destroyed || closed) {
          upstream.destroy()
          return
        }
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n")
        if (head.byteLength) upstream.write(head)
        client.pipe(upstream)
        upstream.pipe(client)
      })
    })().catch(() => client.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"))
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject)
      resolve()
    })
  })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Browser proxy did not bind a TCP port")
  let closing: Promise<void> | undefined
  return {
    url: `http://127.0.0.1:${address.port}`,
    close() {
      if (closing) return closing
      closed = true
      sockets.forEach((socket) => socket.destroy())
      closing = new Promise<void>((resolve) => server.close(() => resolve()))
      return closing
    },
  }
}

function headers(input: IncomingHttpHeaders) {
  const value = { ...input }
  input.connection?.split(",").forEach((name) => delete value[name.trim().toLowerCase()])
  for (const name of [
    "proxy-authorization",
    "proxy-authenticate",
    "proxy-connection",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "upgrade",
    "te",
    "trailer",
  ])
    delete value[name]
  return value
}
