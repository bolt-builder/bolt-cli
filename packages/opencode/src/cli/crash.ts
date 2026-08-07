export * as Crash from "./crash"

import fs from "node:fs"
import path from "node:path"
import { Global } from "@opencode-ai/core/global"
import { InstallationVersion, InstallationChannel } from "@opencode-ai/core/installation/version"
import { Redact } from "@opencode-ai/core/redact"
import { errorMessage } from "@/util/error"

// Crash reports: written locally on unexpected CLI failures, with the same
// secrets firewall applied to prompts and logs, so the /bug flow (and users
// pasting reports into issues) never leaks credentials.
export const directory = path.join(Global.Path.state, "crash")

// Bounds disk usage; the /bug flow only ever needs the most recent reports.
const MAX_REPORTS = 10

export interface Report {
  time: string
  version: string
  channel: string
  platform: string
  arch: string
  argv: string[]
  message: string
  stack?: string
}

export function build(error: unknown, now = new Date()): Report {
  const stack = error instanceof Error ? error.stack : undefined
  return {
    time: now.toISOString(),
    version: InstallationVersion,
    channel: InstallationChannel,
    platform: process.platform,
    arch: process.arch,
    argv: process.argv.slice(2).map((arg) => Redact.text(arg)),
    message: Redact.text(errorMessage(error)),
    stack: stack ? Redact.text(stack) : undefined,
  }
}

export function write(error: unknown, target = directory) {
  const report = build(error)
  const file = path.join(target, `${report.time.replaceAll(":", "-")}-${process.pid}.json`)
  fs.mkdirSync(target, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(report, null, 2))
  prune(target)
  return file
}

export function latest(target = directory): string | undefined {
  if (!fs.existsSync(target)) return undefined
  const names = fs
    .readdirSync(target)
    .filter((name) => name.endsWith(".json"))
    .sort()
  const name = names.at(-1)
  return name ? path.join(target, name) : undefined
}

function prune(target: string) {
  const names = fs
    .readdirSync(target)
    .filter((name) => name.endsWith(".json"))
    .sort()
  for (const name of names.slice(0, Math.max(0, names.length - MAX_REPORTS))) {
    fs.rmSync(path.join(target, name), { force: true })
  }
}
