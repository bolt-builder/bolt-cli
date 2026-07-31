import path from "path"
import { Effect } from "effect"
import type { FSUtil } from "@opencode-ai/core/fs-util"
import { ConfigMarkdown } from "@opencode-ai/core/config/markdown"

export interface Entry {
  readonly path: string
  readonly content: string
}

// Frontmatter dialects that scope when a rule applies. Only unconditional rules are
// imported; glob-scoped, agent-requested, and manual rules are skipped because the
// V1 instruction pipeline has no conditional attachment for foreign files.
type Matter = "cursor" | "windsurf" | "kiro" | "continue"

interface Source {
  readonly tool: string
  readonly patterns: string[]
  readonly matter?: Matter
}

// Rules files written for other coding agents, discovered from the working directory
// up to the worktree root. Order matters only for content dedupe (first match wins).
const sources: Source[] = [
  { tool: "gemini", patterns: ["GEMINI.md"] },
  { tool: "qwen", patterns: ["QWEN.md"] },
  { tool: "zed", patterns: [".rules"] },
  { tool: "aider", patterns: ["CONVENTIONS.md"] },
  { tool: "goose", patterns: [".goosehints"] },
  { tool: "cursor", patterns: [".cursorrules", ".cursor/rules/*.mdc", ".cursor/rules/*.md"], matter: "cursor" },
  { tool: "windsurf", patterns: [".windsurfrules", ".windsurf/rules/*"], matter: "windsurf" },
  { tool: "cline", patterns: [".clinerules", ".clinerules/*.md"] },
  { tool: "roo", patterns: [".roorules", ".roo/rules/*.md"] },
  { tool: "kilo", patterns: [".kilocode/rules/*.md"] },
  { tool: "kiro", patterns: [".kiro/steering/*.md"], matter: "kiro" },
  { tool: "continue", patterns: [".continue/rules/*.md"], matter: "continue" },
  { tool: "copilot", patterns: [".github/copilot-instructions.md"] },
  { tool: "trae", patterns: [".trae/rules/project_rules.md"] },
  { tool: "junie", patterns: [".junie/guidelines.md"] },
  { tool: "amazonq", patterns: [".amazonq/rules/*.md"] },
  { tool: "augment", patterns: [".augment-guidelines", ".augment/rules/*.md"] },
  { tool: "openhands", patterns: [".openhands/microagents/repo.md"] },
]

export const discover = Effect.fn("CompatRules.discover")(function* (
  fs: FSUtil.Interface,
  opts: { directory: string; worktree?: string },
) {
  const visited = new Set<string>()
  const seen = new Set<string>()
  const found: Entry[] = []
  for (const source of sources) {
    for (const pattern of source.patterns) {
      const matches = yield* fs
        .globUp(pattern, opts.directory, opts.worktree)
        .pipe(Effect.catch(() => Effect.succeed([] as string[])))
      for (const match of matches.map((item) => path.resolve(item))) {
        if (visited.has(match)) continue
        visited.add(match)
        const raw = yield* fs.readFileString(match).pipe(Effect.catch(() => Effect.succeed("")))
        const content = include(source.matter, raw)
        if (!content || seen.has(content)) continue
        seen.add(content)
        found.push({ path: match, content })
      }
    }
  }
  return found
})

// Returns the rule body to inject, or undefined when the rule is conditional and
// must not be applied unconditionally. Frontmatter is stripped from the result.
function include(matter: Matter | undefined, raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!matter) return trimmed
  const parsed = ConfigMarkdown.parseOption(raw)
  if (!parsed) return trimmed
  const meta = parsed.data ?? {}
  // Cursor .mdc: alwaysApply true is unconditional; glob-scoped (globs), agent-requested
  // (description only), and manual rules are conditional. Files without frontmatter are
  // treated as unconditional.
  if (matter === "cursor" && Object.keys(meta).length > 0 && meta.alwaysApply !== true) return undefined
  // Windsurf rules: trigger always_on is unconditional; glob, model_decision, and
  // manual triggers are conditional. Files without a trigger are unconditional.
  if (matter === "windsurf" && meta.trigger !== undefined && meta.trigger !== "always_on") return undefined
  // Kiro steering: inclusion defaults to always; fileMatch and manual are conditional.
  if (matter === "kiro" && meta.inclusion !== undefined && meta.inclusion !== "always") return undefined
  // Continue rules: alwaysApply true is unconditional, false is conditional; when
  // absent the rule is unconditional only if no globs scope it.
  if (matter === "continue" && meta.alwaysApply !== true && (meta.alwaysApply === false || meta.globs !== undefined))
    return undefined
  const body = parsed.content.trim()
  return body || undefined
}

export * as CompatRules from "./rules"
