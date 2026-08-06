import type { Argv, InferredOptionTypes } from "yargs"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import type { Config } from "@/config/config"
import { Flag } from "@opencode-ai/core/flag/flag"
import { Effect } from "effect"

const options = {
  port: {
    type: "number" as const,
    describe: "port to listen on",
    default: 0,
  },
  hostname: {
    type: "string" as const,
    describe: "hostname to listen on",
    default: "127.0.0.1",
  },
  mdns: {
    type: "boolean" as const,
    describe: "enable mDNS service discovery (defaults hostname to 0.0.0.0)",
    default: false,
  },
  "mdns-domain": {
    type: "string" as const,
    describe: "custom domain name for mDNS service (default: opencode.local)",
    default: "opencode.local",
  },
  cors: {
    type: "string" as const,
    array: true,
    describe: "additional domains to allow for CORS",
    default: [] as string[],
  },
}

export type NetworkOptions = InferredOptionTypes<typeof options>

export function withNetworkOptions<T>(yargs: Argv<T>) {
  return yargs.options(options)
}

export function hasArg(name: string) {
  return networkArgs().some((arg) => arg === name || arg.startsWith(name + "="))
}

function hasBooleanArg(name: string) {
  return networkArgs().some(
    (arg) => arg === name || arg === name + "=true" || arg === name + "=false" || arg === "--no-" + name.slice(2),
  )
}

function networkArgs() {
  const separator = process.argv.indexOf("--")
  return process.argv.slice(2, separator === -1 ? undefined : separator)
}

export const resolveNetworkOptions = Effect.fn("Cli.resolveNetworkOptions")(function* (args: NetworkOptions) {
  const { Config } = yield* Effect.promise(() => import("@/config/config"))
  const config = yield* Config.Service.use((cfg) => cfg.getGlobal())
  return resolveNetworkOptionsNoConfig(args, config)
})

export function resolveNetworkOptionsNoConfig(args: NetworkOptions, config?: ConfigV1.Info) {
  const portExplicitlySet = hasArg("--port")
  const hostnameExplicitlySet = hasArg("--hostname")
  const mdnsExplicitlySet = hasBooleanArg("--mdns")
  const mdnsDomainExplicitlySet = hasArg("--mdns-domain")
  const mdns = mdnsExplicitlySet ? args.mdns : (config?.server?.mdns ?? args.mdns)
  const mdnsDomain = mdnsDomainExplicitlySet ? args["mdns-domain"] : (config?.server?.mdnsDomain ?? args["mdns-domain"])
  const port = portExplicitlySet ? args.port : (config?.server?.port ?? args.port)
  const hostname = hostnameExplicitlySet
    ? args.hostname
    : mdns && !config?.server?.hostname
      ? "0.0.0.0"
      : (config?.server?.hostname ?? args.hostname)
  const configCors = config?.server?.cors ?? []
  const argsCors = Array.isArray(args.cors) ? args.cors : args.cors ? [args.cors] : []
  const cors = [...configCors, ...argsCors]

  return { hostname, port, mdns, mdnsDomain, cors }
}

/**
 * Refuse to expose an unauthenticated server beyond loopback. The API grants
 * file read/write and shell execution, so binding a non-loopback interface (or
 * advertising it over mDNS) without a password would hand that to the whole LAN.
 *
 * Centralized here so every CLI entrypoint (serve, web, tui) inherits the same
 * check. Tests and internal RPC callers that use `Server.listen` directly
 * bypass this on purpose. When authenticated, or already loopback, the options
 * are returned unchanged; `"localhost"` is pinned to a literal loopback IP
 * because it can resolve to a non-loopback address via DNS/hosts.
 */
export function enforceLoopbackWithoutAuth<T extends { hostname: string; mdns?: boolean }>(
  opts: T,
): { ok: true; opts: T } | { ok: false; error: string } {
  if (Flag.OPENCODE_SERVER_PASSWORD) return { ok: true, opts }
  const pinned = opts.hostname === "localhost" ? { ...opts, hostname: "127.0.0.1" } : opts
  const loopback = pinned.hostname === "127.0.0.1" || pinned.hostname === "::1"
  if (!loopback || pinned.mdns)
    return {
      ok: false,
      error:
        "Refusing to listen on a non-loopback interface without authentication. Set OPENCODE_SERVER_PASSWORD or bind to 127.0.0.1.",
    }
  return { ok: true, opts: pinned }
}
