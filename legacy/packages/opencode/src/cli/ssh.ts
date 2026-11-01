import { spawn, type ChildProcess } from "node:child_process"
import net from "node:net"

// Remote execution transport for `bolt run --host ssh://dev-box`: start (or
// reuse) a `bolt serve` on the remote machine over ssh, forward a local port
// to it, and hand the local URL to the existing --attach plumbing. Requires
// bolt preinstalled on the remote and key-based ssh auth (BatchMode).

export type Target = {
  readonly destination: string
  readonly port?: number
}

export type Remote = {
  readonly url: string
  readonly close: () => void
}

const READY_TIMEOUT_MS = 30_000
const HEALTH_TIMEOUT_MS = 20_000

/** Parse `ssh://user@host[:port]`, `user@host`, or a bare host into an ssh target. */
export function parse(host: string): Target | undefined {
  if (!host.startsWith("ssh://")) {
    if (host.includes("://") || !host.trim()) return undefined
    return { destination: host.trim() }
  }
  const url = (() => {
    try {
      return new URL(host)
    } catch {
      return undefined
    }
  })()
  if (!url || !url.hostname) return undefined
  const destination = url.username ? `${url.username}@${url.hostname}` : url.hostname
  if (!url.port) return { destination }
  return { destination, port: Number(url.port) }
}

/** Build the ssh argv for a target, before the remote command. */
export function args(target: Target, extra: string[] = []) {
  const base = ["-o", "BatchMode=yes"]
  if (target.port) base.push("-p", String(target.port))
  return [...base, ...extra, target.destination]
}

/** Extract the port from a `bolt serve` "listening on http://..." line. */
export function endpoint(output: string): number | undefined {
  const match = output.match(/listening on http:\/\/[^\s:]+:(\d+)/)
  if (!match) return undefined
  return Number(match[1])
}

/** Turn raw ssh output into an actionable connection error. */
export function explain(host: string, output: string) {
  const detail = output.trim()
  if (/command not found|not recognized|No such file/i.test(detail))
    return `bolt is not installed on ${host}. Remote execution requires bolt preinstalled on the remote machine and available on PATH for non-interactive shells.`
  if (/Permission denied|Host key verification failed|BatchMode/i.test(detail))
    return `ssh could not authenticate to ${host} non-interactively. Set up key-based auth (ssh must succeed without a password prompt). ssh said: ${detail}`
  return `Failed to start bolt serve on ${host}${detail ? `: ${detail}` : ""}`
}

/**
 * Start a remote `bolt serve` and forward a free local port to it.
 * Returns the local URL to attach to and a closer that tears down both
 * ssh processes. Both are also killed when this process exits.
 */
export async function connect(input: { host: string }): Promise<Remote> {
  const target = parse(input.host)
  if (!target) throw new Error(`Invalid --host value: ${input.host}. Expected ssh://[user@]host[:port]`)
  // -tt allocates a tty so the remote server dies with the ssh connection.
  const serve = spawn("ssh", [...args(target, ["-tt"]), "--", "bolt", "serve", "--port", "0"], {
    stdio: ["ignore", "pipe", "pipe"],
  })
  const procs: ChildProcess[] = [serve]
  const close = () => {
    for (const proc of procs) if (proc.exitCode === null && !proc.killed) proc.kill()
  }
  process.on("exit", close)
  const remotePort = await new Promise<number>((resolve, reject) => {
    let output = ""
    const timer = setTimeout(() => {
      close()
      reject(new Error(explain(target.destination, output || "timed out waiting for the remote server to start")))
    }, READY_TIMEOUT_MS)
    const consume = (chunk: Buffer) => {
      output += chunk.toString()
      const port = endpoint(output)
      if (!port) return
      clearTimeout(timer)
      resolve(port)
    }
    serve.stdout.on("data", consume)
    serve.stderr.on("data", consume)
    serve.on("exit", () => {
      clearTimeout(timer)
      reject(new Error(explain(target.destination, output)))
    })
    serve.on("error", () => {
      clearTimeout(timer)
      reject(new Error("ssh is not installed or not on PATH"))
    })
  })
  const localPort = await free()
  const forward = spawn(
    "ssh",
    args(target, ["-N", "-o", "ExitOnForwardFailure=yes", "-L", `${localPort}:127.0.0.1:${remotePort}`]),
    { stdio: ["ignore", "ignore", "pipe"] },
  )
  procs.push(forward)
  const url = `http://127.0.0.1:${localPort}`
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  while (true) {
    const healthy = await fetch(`${url}/api/health`)
      .then((response) => response.ok)
      .catch(() => false)
    if (healthy) break
    if (forward.exitCode !== null || Date.now() > deadline) {
      close()
      throw new Error(`Failed to reach the remote bolt server on ${target.destination} through the ssh tunnel`)
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return { url, close }
}

function free() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        server.close()
        reject(new Error("Failed to allocate a local port"))
        return
      }
      server.close(() => resolve(address.port))
    })
    server.on("error", reject)
  })
}

export * as Ssh from "./ssh"
