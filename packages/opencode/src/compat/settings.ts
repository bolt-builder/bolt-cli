import type { ConfigV1 } from "@opencode-ai/core/v1/config/config"

export interface Info {
  readonly rules: boolean
  readonly mcp: boolean
  readonly commands: boolean
  readonly agents: boolean
}

// Rules, commands, and agents default to on: they only add prompt text, user-invoked
// templates, and selectable agents. MCP import defaults to off: imported servers
// execute commands defined in repository files, so it must be an explicit opt-in.
export function settings(value: ConfigV1.Info["compat"]): Info {
  if (value === false) return { rules: false, mcp: false, commands: false, agents: false }
  if (value === true) return { rules: true, mcp: true, commands: true, agents: true }
  return {
    rules: value?.rules ?? true,
    mcp: value?.mcp ?? false,
    commands: value?.commands ?? true,
    agents: value?.agents ?? true,
  }
}

export * as CompatSettings from "./settings"
