import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import http from "node:http"
import https from "node:https"
import { Readable } from "node:stream"
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib"
import { Effect } from "effect"
import { HttpsProxyAgent } from "https-proxy-agent"

// Link-local addresses host cloud instance metadata services (169.254.169.254,
// the AWS IPv6 address fd00:ec2::254, and IPv6 fe80::/10) that hand out credentials, so a
// prompt-injected webfetch there exfiltrates them. Loopback and RFC1918 stay
// fetchable: hitting a local dev server is a core workflow, and those targets
// remain gated by the webfetch permission prompt.
export type Resolver = (host: string) => Promise<readonly string[]>
type Environment = Readonly<Record<string, string | undefined>>

/** Pick a proxy before connecting, respecting the requested hostname and NO_PROXY. */
export function proxyFor(url: URL, env: Environment = process.env) {
  const noProxy = env.no_proxy ?? env.NO_PROXY
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  const port = url.port || (url.protocol === "https:" ? "443" : "80")
  if (
    noProxy?.split(/[\s,]+/).some((entry) => {
      if (entry === "*") return true
      if (!entry) return false
      if (isIP(entry) === 6) return hostname === new URL(`http://[${entry}]/`).hostname.slice(1, -1)
      const match = entry.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/)
      if (!match || (match[2] && match[2] !== port)) return false
      const host = match[1]
        .toLowerCase()
        .replace(/^\[|\]$/g, "")
        .replace(/^\*/, "")
      return host.startsWith(".") ? hostname === host.slice(1) || hostname.endsWith(host) : hostname === host
    })
  )
    return undefined
  return url.protocol === "https:"
    ? (env.https_proxy ?? env.HTTPS_PROXY ?? env.all_proxy ?? env.ALL_PROXY)
    : (env.http_proxy ?? env.HTTP_PROXY ?? env.all_proxy ?? env.ALL_PROXY)
}
const systemResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((entry) => entry.address)

/** Resolve once and reject the entire answer if any address targets link-local services. */
export async function resolveAddresses(url: URL, resolver: Resolver = systemResolver) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("URL must use http:// or https://")
  const host = url.hostname.replace(/^\[|\]$/g, "")
  const addresses = isIP(host) ? [host] : await resolver(host)
  if (addresses.length === 0) throw new Error(`No address found for ${url.hostname}`)
  for (const address of addresses) {
    if (!isIP(address)) throw new Error(`Invalid resolved address for ${url.hostname}`)
    if (isLinkLocal(address)) throw new Error(`Refusing to fetch link-local address ${address} for ${url.hostname}`)
  }
  return addresses
}

export const assertFetchable = (url: URL) =>
  Effect.tryPromise({
    try: async () => {
      await resolveAddresses(url)
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  })

/** Connect to the validated address without a second DNS lookup. URL host, Host header and TLS SNI stay original. */
export function makeFetch(resolver: Resolver = systemResolver, env: Environment = process.env) {
  return async function fetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
    const url = new URL(input)
    const addresses = await resolveAddresses(url, resolver)
    if (init.signal?.aborted) throw init.signal.reason
    const selected = proxyFor(url, env)
    let proxy: URL | undefined
    if (selected) {
      try {
        proxy = new URL(selected)
      } catch {
        throw new Error("Invalid configured HTTP proxy URL")
      }
      if (proxy.protocol !== "http:" && proxy.protocol !== "https:")
        throw new Error("Unsupported proxy protocol for secure fetch")
    }
    const header = new Headers(init.headers)
    if (proxy && !header.has("host")) header.set("host", url.host)
    if (!header.has("accept-encoding")) header.set("accept-encoding", "identity")
    const body = init.body
    if (body instanceof URLSearchParams && !header.has("content-type"))
      header.set("content-type", "application/x-www-form-urlencoded;charset=UTF-8")
    if (body != null && typeof body !== "string" && !(body instanceof Uint8Array) && !(body instanceof URLSearchParams))
      throw new Error("Unsupported request body")
    let lastError: unknown
    for (const address of addresses) {
      try {
        return await new Promise<Response>((resolveResponse, reject) => {
          const connect = url.protocol === "https:" ? https : http
          const target = new URL(url)
          if (proxy) target.hostname = isIP(address) === 6 ? `[${address}]` : address
          const request = connect.request(
            target,
            {
              method: init.method ?? "GET",
              headers: Object.fromEntries(header),
              agent: proxy ? new HttpsProxyAgent(proxy) : false,
              // The proxy CONNECT uses the validated IP, but TLS must verify and send the original hostname.
              servername: proxy && !isIP(url.hostname.replace(/^\[|\]$/g, "")) ? url.hostname : undefined,
              family: isIP(address),
              signal: init.signal ?? undefined,
              lookup: (_host, _options, callback) => callback(null, address, isIP(address)),
            },
            (response) => {
              const headers = new Headers()
              for (let index = 0; index < response.rawHeaders.length; index += 2)
                headers.append(response.rawHeaders[index], response.rawHeaders[index + 1])
              const encoding = (headers.get("content-encoding") ?? "").toLowerCase()
              const decode =
                encoding === "gzip"
                  ? createGunzip()
                  : encoding === "deflate"
                    ? createInflate()
                    : encoding === "br"
                      ? createBrotliDecompress()
                      : undefined
              if (decode) {
                response.on("error", (error) => decode.destroy(error))
                decode.on("close", () => response.destroy())
              }
              const stream = decode ? response.pipe(decode) : response
              // SAFETY: Node's toWeb adapter yields the byte stream expected by the web Response constructor.
              const web = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>
              const status = response.statusCode ?? 500
              const result = new Response(
                [101, 204, 205, 304].includes(status) || init.method?.toUpperCase() === "HEAD" ? null : web,
                {
                  status,
                  statusText: response.statusMessage,
                  headers,
                },
              )
              Object.defineProperty(result, "url", { value: url.href })
              resolveResponse(result)
            },
          )
          request.on("error", reject)
          if (body != null) request.write(body instanceof URLSearchParams ? body.toString() : body)
          request.end()
        })
      } catch (error) {
        lastError = error
        // Only connection-establishment failures can be retried without replaying a received POST.
        if (
          init.signal?.aborted ||
          !(error instanceof Error) ||
          !("code" in error) ||
          !["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "EADDRNOTAVAIL"].includes(String(error.code))
        )
          throw error
      }
    }
    throw lastError
  }
}

export const fetch = makeFetch()

function isLinkLocal(address: string) {
  const lower = isIP(address) === 6 ? new URL(`http://[${address}]/`).hostname.slice(1, -1) : address.toLowerCase()
  if (isIP(lower) === 4) return lower.startsWith("169.254.")
  if (lower === "fd00:ec2::254") return true
  // IPv4-mapped IPv6 in dotted (::ffff:169.254.0.1) or hex (::ffff:a9fe:1) form.
  if (lower.startsWith("::ffff:")) {
    const rest = lower.slice(7)
    if (isIP(rest) === 4) return rest.startsWith("169.254.")
    const high = parseInt(rest.split(":", 1)[0], 16)
    return high >>> 8 === 0xa9 && (high & 0xff) === 0xfe
  }
  // fe80::/10 spans first hextets fe80 through febf.
  const first = parseInt(lower.split(":", 1)[0], 16)
  return first >= 0xfe80 && first <= 0xfebf
}
