import { describe, expect } from "bun:test"
import path from "path"
import { Effect } from "effect"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { LayerNodePlatform } from "@opencode-ai/core/effect/app-node-platform"
import { CompatMCP } from "@/compat/mcp"
import { tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([CrossSpawnSpawner.node, LayerNodePlatform.filesystem, FSUtil.node])),
)

const setup = (files: Record<string, string>) =>
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const dir = yield* tmpdirScoped()
    const home = yield* tmpdirScoped()
    for (const [file, content] of Object.entries(files)) {
      yield* fs.writeWithDirs(path.join(dir, file), content)
    }
    return { fs, dir, home }
  })

describe("CompatMCP.discover", () => {
  it.effect("translates stdio and remote servers from mcpServers files", () =>
    Effect.gen(function* () {
      const { fs, dir, home } = yield* setup({
        ".cursor/mcp.json": JSON.stringify({
          mcpServers: {
            local: { command: "npx", args: ["-y", "server"], env: { KEY: "value" } },
            remote: { url: "https://mcp.example.com", headers: { Authorization: "Bearer token" } },
          },
        }),
      })
      const found = yield* CompatMCP.discover(fs, { directory: dir, worktree: dir, home })
      expect(found).toEqual({
        local: { type: "local", command: ["npx", "-y", "server"], environment: { KEY: "value" } },
        remote: { type: "remote", url: "https://mcp.example.com", headers: { Authorization: "Bearer token" } },
      })
    }),
  )

  it.effect("reads the vscode servers key, skipping prompted inputs", () =>
    Effect.gen(function* () {
      const { fs, dir, home } = yield* setup({
        ".vscode/mcp.json": JSON.stringify({
          servers: {
            usable: { type: "http", url: "https://mcp.example.com" },
            prompted: { type: "stdio", command: "npx", args: ["server"], env: { KEY: "${input:key}" } },
          },
        }),
      })
      const found = yield* CompatMCP.discover(fs, { directory: dir, worktree: dir, home })
      expect(found).toEqual({ usable: { type: "remote", url: "https://mcp.example.com" } })
    }),
  )

  it.effect("skips disabled servers and tolerates jsonc", () =>
    Effect.gen(function* () {
      const { fs, dir, home } = yield* setup({
        ".kiro/settings/mcp.json": [
          "{",
          "  // kiro settings",
          '  "mcpServers": {',
          '    "off": { "command": "npx", "args": ["server"], "disabled": true },',
          '    "on": { "command": "uvx", "args": ["other"] },',
          "  }",
          "}",
        ].join("\n"),
      })
      const found = yield* CompatMCP.discover(fs, { directory: dir, worktree: dir, home })
      expect(found).toEqual({ on: { type: "local", command: ["uvx", "other"] } })
    }),
  )

  it.effect("keeps the first definition when names collide", () =>
    Effect.gen(function* () {
      const { fs, dir, home } = yield* setup({
        ".mcp.json": JSON.stringify({ mcpServers: { shared: { command: "first" } } }),
        ".cursor/mcp.json": JSON.stringify({ mcpServers: { shared: { command: "second" } } }),
      })
      const found = yield* CompatMCP.discover(fs, { directory: dir, worktree: dir, home })
      expect(found).toEqual({ shared: { type: "local", command: ["first"] } })
    }),
  )

  it.effect("imports codex servers from the global TOML config", () =>
    Effect.gen(function* () {
      const { fs, dir, home } = yield* setup({})
      yield* fs.writeWithDirs(
        path.join(home, ".codex", "config.toml"),
        [
          "[mcp_servers.codex]",
          'command = "npx"',
          'args = ["-y", "server"]',
          "",
          "[mcp_servers.codex.env]",
          'KEY = "value"',
        ].join("\n"),
      )
      const found = yield* CompatMCP.discover(fs, { directory: dir, worktree: dir, home })
      expect(found).toEqual({
        codex: { type: "local", command: ["npx", "-y", "server"], environment: { KEY: "value" } },
      })
    }),
  )

  it.effect("ignores unparseable and empty files", () =>
    Effect.gen(function* () {
      const { fs, dir, home } = yield* setup({
        ".mcp.json": "not json at all {{{",
        ".roo/mcp.json": "",
        ".kilocode/mcp.json": JSON.stringify({ mcpServers: { ok: { command: "npx" } } }),
      })
      const found = yield* CompatMCP.discover(fs, { directory: dir, worktree: dir, home })
      expect(found).toEqual({ ok: { type: "local", command: ["npx"] } })
    }),
  )
})
