import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { Effect } from "effect"

// Link-local addresses host cloud instance metadata services (169.254.169.254,
// fd00:ec2::254 style endpoints on fe80::/10) that hand out credentials, so a
// prompt-injected webfetch there exfiltrates them. Loopback and RFC1918 stay
// fetchable: hitting a local dev server is a core workflow, and those targets
// remain gated by the webfetch permission prompt.
export const assertFetchable = (url: URL) =>
  Effect.tryPromise({
    try: async () => {
      const host = url.hostname.replace(/^\[|\]$/g, "")
      const addresses = isIP(host)
        ? [host]
        : (await lookup(host, { all: true })).map((entry) => entry.address)
      for (const address of addresses) {
        if (isLinkLocal(address)) throw new Error(`Refusing to fetch link-local address ${address} for ${url.hostname}`)
      }
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  })

function isLinkLocal(address: string) {
  const lower = address.toLowerCase()
  if (isIP(lower) === 4) return lower.startsWith("169.254.")
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

export * as NetGuard from "./net-guard"
