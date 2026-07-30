import type { ConfigV1 } from "@opencode-ai/core/v1/config/config"

export interface Info {
  readonly rules: boolean
  readonly mcp: boolean
}

// Rules import defaults to on: it only injects extra instruction text into the prompt.
// MCP import defaults to off: imported servers execute commands defined in repository
// files, so it must be an explicit opt-in.
export function settings(value: ConfigV1.Info["compat"]): Info {
  if (value === false) return { rules: false, mcp: false }
  if (value === true) return { rules: true, mcp: true }
  return { rules: value?.rules ?? true, mcp: value?.mcp ?? false }
}

export * as CompatSettings from "./settings"
