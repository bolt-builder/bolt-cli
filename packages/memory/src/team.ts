import { mkdir, readFile, stat, writeFile } from "fs/promises"
import path from "path"
import { MemoryMarkdown } from "./storage/markdown"
import { MemorySlug } from "./slug"

/** Opt-in shared project memory: a reviewable markdown file committed to the repository at
 * .bolt/memory.md. Teammates opt in by committing the file; sessions read it automatically when it
 * exists, and `bolt memory team share <query>` copies personal facts into it for review. */
export const FILE = ".bolt/memory.md"

/** Display source label for team entries in recall output. */
export const SOURCE = "team.md"

const HEADER = [
  "# Bolt team memory",
  "",
  "Shared project memory, reviewed like code. Entries are `- key :: text` lines under `## Section` headings.",
  "Bolt sessions read this file automatically once it is committed.",
  "",
  "## Facts",
  "",
].join("\n")

export type Item = { section: string; key: string; text: string }

export function location(worktree: string) {
  return path.join(worktree, FILE)
}

export async function exists(worktree: string) {
  return stat(location(worktree)).then(
    (info) => info.isFile(),
    () => false,
  )
}

export async function read(worktree: string) {
  const file = location(worktree)
  const info = await stat(file).catch(() => undefined)
  if (!info?.isFile()) return { items: [] as Item[], updatedAt: 0 }
  const text = await readFile(file, "utf8")
  return { items: MemoryMarkdown.parse(text) as Item[], updatedAt: info.mtimeMs }
}

export async function init(worktree: string) {
  if (await exists(worktree)) return { created: false, file: location(worktree) }
  await mkdir(path.dirname(location(worktree)), { recursive: true })
  await writeFile(location(worktree), HEADER)
  return { created: true, file: location(worktree) }
}

export async function share(worktree: string, items: Item[]) {
  await init(worktree)
  const file = location(worktree)
  const text = await readFile(file, "utf8")
  const next = items.reduce(
    (doc, item) =>
      MemoryMarkdown.upsert({
        text: doc,
        section: item.section || "Facts",
        line: MemoryMarkdown.line(item.key, item.text),
      }).text,
    text,
  )
  if (next !== text) await writeFile(file, next.endsWith("\n") ? next : `${next}\n`)
  return { count: items.length, file }
}

/** Pure selection of shareable facts: match a query against a fact's key, id, and slugged aliases. */
export function match(input: {
  items: { id: string; file: string; section: string; key: string; text: string }[]
  query: string
}) {
  const query = input.query.trim()
  if (!query) return []
  const slug = MemorySlug.safe(query, { max: MemorySlug.max.key, fallback: "", lower: true })
  return input.items.filter((item) => {
    const aliases = new Set([item.id, item.key, `${item.file}:${item.key}`, `${item.file}:${item.section}:${item.key}`])
    return aliases.has(query) || (slug !== "" && aliases.has(slug))
  })
}

export * as MemoryTeam from "./team"
