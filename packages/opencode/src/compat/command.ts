import path from "path"
import { Effect } from "effect"
import type { FSUtil } from "@opencode-ai/core/fs-util"
import { ConfigMarkdown } from "@opencode-ai/core/config/markdown"
import type { ConfigCommandV1 } from "@opencode-ai/core/v1/config/command"

// Command/workflow directories written by other coding agents. The markdown body
// becomes the command template; Claude's $ARGUMENTS / $1..$N placeholder dialect
// matches ours, so bodies pass through unchanged. First definition of a name wins.
const sources = [
  { tool: "claude", root: ".claude/commands/" },
  { tool: "cursor", root: ".cursor/commands/" },
  { tool: "roo", root: ".roo/commands/" },
  { tool: "kilo", root: ".kilocode/workflows/" },
  { tool: "windsurf", root: ".windsurf/workflows/" },
]

export const discover = Effect.fn("CompatCommand.discover")(function* (
  fs: FSUtil.Interface,
  opts: { directory: string; worktree?: string; home: string },
) {
  const found: Record<string, ConfigCommandV1.Info> = {}
  const add = (root: string, match: string, raw: string) => {
    const entry = translate(raw)
    if (!entry) return
    const name = nameFor(root, match)
    if (!name || found[name]) return
    found[name] = entry
  }
  for (const source of sources) {
    const matches = yield* fs
      .globUp(`${source.root}**/*.md`, opts.directory, opts.worktree)
      .pipe(Effect.catch(() => Effect.succeed([] as string[])))
    for (const match of matches) {
      const raw = yield* fs.readFileString(match).pipe(Effect.catch(() => Effect.succeed("")))
      add(source.root, match, raw)
    }
  }
  // Codex keeps custom prompts in a global directory.
  const prompts = yield* fs
    .glob(".codex/prompts/**/*.md", { cwd: opts.home, absolute: true, include: "file", dot: true })
    .pipe(Effect.catch(() => Effect.succeed([] as string[])))
  for (const match of prompts) {
    add(".codex/prompts/", match, yield* fs.readFileString(match).pipe(Effect.catch(() => Effect.succeed(""))))
  }
  return found
})

// Nested directories stay in the name with "/" separators, matching the native
// command convention (.opencode/command/git/commit.md -> git/commit).
function nameFor(root: string, filepath: string) {
  const normalized = filepath.replaceAll("\\", "/")
  const marker = `/${root}`
  const start = normalized.lastIndexOf(marker)
  if (start === -1) return undefined
  const rest = normalized.slice(start + marker.length)
  const ext = path.extname(rest)
  return ext.length ? rest.slice(0, -ext.length) : rest
}

function translate(raw: string): ConfigCommandV1.Info | undefined {
  if (!raw.trim()) return undefined
  const parsed = ConfigMarkdown.parseOption(raw)
  if (!parsed) return { template: raw.trim() }
  const template = parsed.content.trim()
  if (!template) return undefined
  const meta = parsed.data ?? {}
  const description = typeof meta.description === "string" ? meta.description : undefined
  // Foreign model names (e.g. Claude's "sonnet") don't resolve here; only keep
  // provider-qualified "provider/model" references.
  const model = typeof meta.model === "string" && meta.model.includes("/") ? meta.model : undefined
  return {
    template,
    ...(description ? { description } : {}),
    ...(model ? { model } : {}),
  }
}

export * as CompatCommand from "./command"
