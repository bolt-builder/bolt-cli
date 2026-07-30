import path from "path"
import { pathToFileURL } from "url"
import { Effect } from "effect"
import { parse } from "jsonc-parser"
import type { FSUtil } from "@opencode-ai/core/fs-util"
import type { ConfigMCPV1 } from "@opencode-ai/core/v1/config/mcp"

// MCP server definition files written by other coding agents, discovered from the
// working directory up to the worktree root. First definition of a name wins.
const files = [
  ".mcp.json", // Claude Code
  ".cursor/mcp.json",
  ".vscode/mcp.json",
  ".kilocode/mcp.json",
  ".roo/mcp.json",
  ".kiro/settings/mcp.json",
  ".gemini/settings.json",
]

export const discover = Effect.fnUntraced(function* (
  fs: FSUtil.Interface,
  opts: { directory: string; worktree?: string; home: string },
) {
  const found: Record<string, ConfigMCPV1.Info> = {}
  const add = (data: unknown) => {
    for (const [name, entry] of Object.entries(servers(data))) {
      if (found[name]) continue
      const translated = translate(entry)
      if (translated) found[name] = translated
    }
  }
  for (const file of files) {
    const matches = yield* fs
      .globUp(file, opts.directory, opts.worktree)
      .pipe(Effect.catch(() => Effect.succeed([] as string[])))
    for (const match of matches) {
      const raw = yield* fs.readFileString(match).pipe(Effect.catch(() => Effect.succeed("")))
      if (!raw.trim()) continue
      add(parse(raw, [], { allowTrailingComma: true }))
    }
  }
  // Codex keeps MCP servers in a global TOML config.
  const codex = path.join(opts.home, ".codex", "config.toml")
  if (yield* fs.existsSafe(codex)) {
    const data = yield* Effect.tryPromise({
      try: () => import(pathToFileURL(codex).href, { with: { type: "toml" } }).then((mod) => mod.default),
      catch: () => undefined,
    }).pipe(Effect.catch(() => Effect.succeed(undefined)))
    add(data)
  }
  return found
})

// The server map key differs per tool: mcpServers (Claude, Cursor, Roo, Kilo, Kiro,
// Gemini), servers (VS Code), mcp_servers (Codex TOML).
function servers(data: unknown) {
  const item = record(data)
  if (!item) return {}
  return record(item.mcpServers) ?? record(item.servers) ?? record(item.mcp_servers) ?? {}
}

function translate(entry: unknown): ConfigMCPV1.Info | undefined {
  const item = record(entry)
  if (!item) return undefined
  if (item.disabled === true) return undefined
  if (item.enabled === false) return undefined
  // VS Code-style prompted inputs cannot be resolved outside that editor.
  if (JSON.stringify(item).includes("${input:")) return undefined
  const url = [item.url, item.serverUrl, item.httpUrl].find((value) => typeof value === "string")
  if (typeof url === "string") {
    const headers = strings(item.headers)
    return { type: "remote", url, ...(headers ? { headers } : {}) }
  }
  if (typeof item.command !== "string" || !item.command) return undefined
  const args = Array.isArray(item.args) ? item.args.filter((value): value is string => typeof value === "string") : []
  const env = strings(item.env) ?? strings(item.environment)
  const cwd = typeof item.cwd === "string" ? item.cwd : undefined
  return {
    type: "local",
    command: [item.command, ...args],
    ...(env ? { environment: env } : {}),
    ...(cwd ? { cwd } : {}),
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function strings(value: unknown) {
  const item = record(value)
  if (!item) return undefined
  const entries = Object.entries(item).filter((pair): pair is [string, string] => typeof pair[1] === "string")
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries)
}

export * as CompatMCP from "./mcp"
