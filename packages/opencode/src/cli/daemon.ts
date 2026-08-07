export * as Daemon from "./daemon"

import fs from "node:fs"
import path from "node:path"
import { Global } from "@opencode-ai/core/global"

// Discovery record for `bolt daemon`: a warm server that one-shot commands
// route through instead of booting an in-process server. The record lives in
// the state dir so every bolt process on the machine can find it.
export const file = path.join(Global.Path.state, "daemon.json")

export interface Info {
  url: string
  pid: number
  started: number
}

export async function read(target = file): Promise<Info | undefined> {
  const data: unknown = await Bun.file(target)
    .json()
    .catch(() => undefined)
  if (!data || typeof data !== "object") return undefined
  const info = data as Record<string, unknown>
  if (typeof info.url !== "string") return undefined
  if (typeof info.pid !== "number") return undefined
  if (typeof info.started !== "number") return undefined
  return { url: info.url, pid: info.pid, started: info.started }
}

export async function write(info: Info, target = file) {
  await Bun.write(target, JSON.stringify(info, null, 2))
}

export function clear(target = file) {
  fs.rmSync(target, { force: true })
}

export function alive(pid: number) {
  // Signal 0 performs the existence check without delivering a signal.
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function probe(url: string, timeout = 1000): Promise<boolean> {
  const { ServerAuth } = await import("@/server/auth")
  const response = await fetch(new URL("/global/health", url), {
    headers: ServerAuth.headers(),
    signal: AbortSignal.timeout(timeout),
  }).catch(() => undefined)
  if (!response || !response.ok) return false
  const body: unknown = await response.json().catch(() => undefined)
  if (!body || typeof body !== "object") return false
  return (body as Record<string, unknown>).healthy === true
}

export async function detect(target = file): Promise<Info | undefined> {
  const info = await read(target)
  if (!info) return undefined
  if (alive(info.pid) && (await probe(info.url))) return info
  // Drop stale records so later one-shots skip the probe entirely.
  clear(target)
  return undefined
}
