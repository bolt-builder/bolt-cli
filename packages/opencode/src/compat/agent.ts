import { Effect } from "effect"
import type { FSUtil } from "@opencode-ai/core/fs-util"
import type { ConfigAgentV1 } from "@opencode-ai/core/v1/config/agent"

// Custom mode files written by Roo Code and Kilo Code. Both use the same shape:
// { customModes: [{ slug, name, description?, roleDefinition, whenToUse?,
//   customInstructions?, groups? }] } in YAML or JSON. Modes map onto primary agents.
const files = [".roomodes", ".kilocodemodes"]

export const discover = Effect.fnUntraced(function* (
  fs: FSUtil.Interface,
  opts: { directory: string; worktree?: string },
) {
  const found: Record<string, ConfigAgentV1.Info> = {}
  for (const file of files) {
    const matches = yield* fs
      .globUp(file, opts.directory, opts.worktree)
      .pipe(Effect.catch(() => Effect.succeed([] as string[])))
    for (const match of matches) {
      const raw = yield* fs.readFileString(match).pipe(Effect.catch(() => Effect.succeed("")))
      for (const mode of modes(raw)) {
        const entry = translate(mode)
        if (!entry) continue
        if (found[entry.slug]) continue
        found[entry.slug] = entry.agent
      }
    }
  }
  return found
})

function modes(raw: string) {
  if (!raw.trim()) return []
  const data = parse(raw)
  if (typeof data !== "object" || data === null || Array.isArray(data)) return []
  const list = (data as Record<string, unknown>).customModes
  return Array.isArray(list) ? list : []
}

// Roo accepts both YAML and JSON for .roomodes; YAML is a superset of JSON but
// Bun.YAML rejects some valid JSON edge cases, so try JSON first.
function parse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    try {
      return Bun.YAML.parse(raw)
    } catch {
      return undefined
    }
  }
}

function translate(mode: unknown): { slug: string; agent: ConfigAgentV1.Info } | undefined {
  if (typeof mode !== "object" || mode === null) return undefined
  const item = mode as Record<string, unknown>
  const slug = typeof item.slug === "string" ? item.slug.trim() : ""
  if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug)) return undefined
  const role = typeof item.roleDefinition === "string" ? item.roleDefinition.trim() : ""
  const extra = typeof item.customInstructions === "string" ? item.customInstructions.trim() : ""
  const prompt = [role, extra].filter(Boolean).join("\n\n")
  if (!prompt) return undefined
  const description = [item.description, item.whenToUse, item.name].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  )
  const permission = restrict(item.groups)
  return {
    slug,
    agent: {
      mode: "primary",
      prompt,
      ...(description ? { description: description.trim() } : {}),
      ...(permission ? { permission } : {}),
    },
  }
}

// Roo/Kilo groups grant capabilities (read, edit, command, browser, mcp); a group
// entry can be a tuple like ["edit", { fileRegex }]. Absent groups mean the mode
// must not use that capability, which maps to a deny. Modes without a groups list
// keep the default permissions.
function restrict(groups: unknown) {
  if (!Array.isArray(groups)) return undefined
  const names = new Set(
    groups
      .map((group) => (Array.isArray(group) ? group[0] : group))
      .filter((name): name is string => typeof name === "string"),
  )
  const denied = {
    ...(names.has("edit") ? {} : { edit: "deny" as const }),
    ...(names.has("command") ? {} : { bash: "deny" as const }),
    ...(names.has("browser") ? {} : { webfetch: "deny" as const }),
  }
  return Object.keys(denied).length ? denied : undefined
}

export * as CompatAgent from "./agent"
