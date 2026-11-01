import type { MemoryOperations } from "./capture/operations"
import { MemoryMarkdown } from "./storage/markdown"
import { MemorySchema } from "./schema"

/** Import/export of project memory as one reviewable markdown document. Each source file becomes a
 * `## <source>` block whose sections are demoted one level, so the document round-trips through the
 * store's own line grammar and reads cleanly in any markdown viewer or code review. */
export const TITLE = "# Bolt project memory export"

export function serialize(input: { sources: Partial<Record<MemorySchema.Source, string>>; at?: number }) {
  const at = input.at ?? Date.now()
  const counted = MemorySchema.Sources.map((file) => ({
    file,
    text: input.sources[file] ?? "",
    entries: MemoryMarkdown.parse(input.sources[file] ?? "").length,
  }))
  const blocks = counted
    .filter((item) => item.entries > 0)
    .flatMap((item) => [
      `## ${item.file}`,
      ...item.text.split("\n").map((line) => (line.trim().startsWith("## ") ? `#${line.trim()}` : line)),
      "",
    ])
  const text = [TITLE, "", "Version: 1", `Exported: ${new Date(at).toISOString()}`, "", ...blocks]
    .join("\n")
    .replaceAll(/\n{3,}/g, "\n\n")
  return {
    text: `${text.trimEnd()}\n`,
    count: counted.reduce((sum, item) => sum + item.entries, 0),
  }
}

export function parse(text: string) {
  const ops: MemoryOperations.Add[] = []
  const skipped: string[] = []
  const docs = new Map<MemorySchema.Source, string[]>()
  let current: MemorySchema.Source | undefined
  for (const raw of text.split("\n")) {
    const value = raw.trim()
    if (value.startsWith("## ")) {
      const name = value.slice(3).trim()
      current = MemorySchema.source(name)
      if (!current && name) skipped.push(name)
      continue
    }
    if (!current) continue
    const lines = docs.get(current) ?? []
    lines.push(value.startsWith("### ") ? value.slice(1) : raw)
    docs.set(current, lines)
  }
  for (const [file, lines] of docs) {
    for (const entry of MemoryMarkdown.parse(lines.join("\n"))) {
      ops.push({ action: "add", file, section: entry.section, key: entry.key, text: entry.text })
    }
  }
  return { ops, skipped }
}

export * as MemoryPortable from "./portable"
