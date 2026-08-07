import path from "path"
import { Database } from "@opencode-ai/core/database/database"
import { Global } from "@opencode-ai/core/global"
import { Glob } from "@opencode-ai/core/util/glob"
import { configEntryNameFromPath } from "@/config/entry-name"

// Built-in agents from src/agent/agent.ts; config-defined agents are merged in
// at completion time. Kept static so completion never boots a full instance.
const BUILTIN = [
  "ask",
  "code",
  "code-review",
  "debug",
  "docs",
  "explore",
  "general",
  "migrate",
  "perf",
  "plan",
  "refactor",
  "security",
]

/** Keep only candidates matching the word being completed. */
export function match(values: string[], current: string) {
  if (!current) return values
  return values.filter((value) => value.startsWith(current))
}

/**
 * Dynamic completions for the word being typed, keyed on the preceding flag.
 * Returns undefined when the flag has no dynamic values so the caller can fall
 * back to the default yargs completions.
 */
export async function dynamic(previous: string, current: string) {
  if (previous === "--model" || previous === "-m") return match(await models(), current)
  if (previous === "--agent") return match(await agents(), current)
  if (previous === "--session" || previous === "-s") return match(await sessions(), current)
  return undefined
}

/** Model ids from the models.dev cache; empty when the cache has not been populated yet. */
export async function models() {
  const file = Bun.file(path.join(Global.Path.cache, "models.json"))
  if (!(await file.exists())) return []
  const catalog: Record<string, { models?: Record<string, unknown> }> | undefined = await file
    .json()
    .catch(() => undefined)
  if (!catalog) return []
  return Object.entries(catalog)
    .flatMap((entry) => Object.keys(entry[1].models ?? {}).map((modelID) => `${entry[0]}/${modelID}`))
    .sort()
}

/** Built-in agent names plus agents defined in the global and project config directories. */
export async function agents() {
  const names = new Set(BUILTIN)
  const dirs = [Global.Path.config, path.join(process.cwd(), ".opencode")]
  for (const dir of dirs) {
    const items: string[] = await Glob.scan("{agent,agents}/**/*.md", {
      cwd: dir,
      absolute: true,
      dot: true,
      symlink: true,
    }).catch(() => [])
    for (const item of items) names.add(configEntryNameFromPath(path.relative(dir, item), ["agent/", "agents/"]))
  }
  return [...names].sort()
}

/** Most recently updated session ids, read straight from the sqlite database. */
export async function sessions(limit = 50) {
  const file = Database.path()
  if (!(await Bun.file(file).exists())) return []
  const sqlite = await import("bun:sqlite")
  const db = new sqlite.Database(file, { readonly: true })
  try {
    const rows = db.query("SELECT id FROM session ORDER BY time_updated DESC LIMIT ?").all(limit) as { id: string }[]
    return rows.map((row) => row.id)
  } finally {
    db.close()
  }
}

/**
 * Fish completion adapter. Bash and zsh scripts come from the yargs built-in
 * (`bolt completion`); fish routes through the same --get-yargs-completions
 * callback so it gets the dynamic values too.
 */
export function fish() {
  return [
    "function __fish_bolt_complete",
    "    set -l tokens (commandline -opc)",
    "    set -l current (commandline -ct)",
    "    $tokens[1] --get-yargs-completions $tokens[2..-1] $current",
    "end",
    'complete -c bolt -f -a "(__fish_bolt_complete)"',
  ].join("\n")
}

export * as Complete from "./complete"
