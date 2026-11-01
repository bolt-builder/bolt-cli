import path from "node:path"
import { Effect } from "effect"
import { effectCmd, fail } from "../effect-cmd"

const MATCH = /\.(ts|tsx|js|jsx)$/
const SKIP = new Set([".git", "node_modules", "dist", "build", ".turbo"])
const DECLARATION =
  /^\s*export\s+(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/
const HEAD_CAP = 10
const BLOCK_CAP = 100
const SHOW = 120

export type Item = { file: string; name: string; signature: string }
export type Change = { file: string; name: string; before: string; after: string }
export type Delta = { added: Item[]; removed: Item[]; changed: Change[] }

/**
 * One-line signature of a value-like export starting at `index`: lines are
 * joined until parentheses and angle brackets balance (capped), whitespace
 * collapses, and the implementation after the opening brace or arrow is
 * dropped. Function and class bodies are not part of the public surface.
 */
export function signature(lines: string[], index: number) {
  const taken: string[] = []
  let round = 0
  let angle = 0
  for (let cursor = index; cursor < Math.min(lines.length, index + HEAD_CAP); cursor++) {
    taken.push(lines[cursor])
    for (const char of lines[cursor]) {
      if (char === "(") round += 1
      if (char === ")") round -= 1
      if (char === "<") angle += 1
      if (char === ">") angle -= 1
    }
    if (round <= 0 && angle <= 0) break
  }
  return taken
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s*(\{|=>).*$/, "")
    .replace(/\s*=\s*$/, "")
    .trim()
}

/**
 * Full normalized declaration of a structure-like export (interface, enum,
 * type alias): the body is the API, so lines are joined until curly braces
 * balance, capped. Braceless type aliases stop at the first non-continuation
 * line, a first-line heuristic that misses leading-pipe union formatting.
 */
export function block(lines: string[], index: number) {
  const taken: string[] = []
  let depth = 0
  let started = false
  for (let cursor = index; cursor < Math.min(lines.length, index + BLOCK_CAP); cursor++) {
    const line = lines[cursor]
    taken.push(line)
    for (const char of line) {
      if (char === "{") {
        depth += 1
        started = true
      }
      if (char === "}") depth -= 1
    }
    if (started && depth <= 0) break
    if (!started && !/[|&=,{(<]\s*$/.test(line)) break
  }
  return taken.join(" ").replace(/\s+/g, " ").trim()
}

/** Exported declarations per file, keyed for diffing by file plus name. */
export function surface(files: Record<string, string>) {
  return Object.keys(files)
    .sort()
    .flatMap((file) => {
      const lines = files[file].split("\n")
      return lines.flatMap((line, index) => {
        const match = line.match(DECLARATION)
        if (!match) return []
        const structural = match[1] === "interface" || match[1] === "enum" || match[1] === "type"
        return [{ file, name: match[2], signature: structural ? block(lines, index) : signature(lines, index) }]
      })
    })
}

/** Symbols added, removed, or re-declared with a different signature between two surfaces. */
export function diff(before: Item[], after: Item[]): Delta {
  const key = (item: Item) => `${item.file}\u0000${item.name}`
  const old = new Map(before.map((item) => [key(item), item]))
  const now = new Map(after.map((item) => [key(item), item]))
  const added = after.filter((item) => !old.has(key(item)))
  const removed = before.filter((item) => !now.has(key(item)))
  const changed = after.flatMap((item) => {
    const previous = old.get(key(item))
    if (!previous || previous.signature === item.signature) return []
    return [{ file: item.file, name: item.name, before: previous.signature, after: item.signature }]
  })
  return { added, removed, changed }
}

/** Renders the delta as markdown: breaking changes (removed and changed) first, then additions. */
export function markdown(delta: Delta, base: string) {
  const breaking = delta.removed.length + delta.changed.length
  if (breaking + delta.added.length === 0) return `# API surface\n\nNo public surface changes against ${base}.\n`
  const clip = (text: string) => (text.length > SHOW ? `${text.slice(0, SHOW)}...` : text)
  const sections = [
    "# API surface",
    "",
    `Compared against ${base}: ${breaking} breaking, ${delta.added.length} added.`,
    "",
  ]
  if (delta.removed.length > 0) {
    sections.push(
      "## Removed (breaking)",
      "",
      ...delta.removed.map((item) => `- \`${item.name}\` in \`${item.file}\``),
      "",
    )
  }
  if (delta.changed.length > 0) {
    sections.push("## Changed (breaking)", "")
    for (const change of delta.changed) {
      sections.push(
        `- \`${change.name}\` in \`${change.file}\``,
        `  - before: \`${clip(change.before)}\``,
        `  - after: \`${clip(change.after)}\``,
      )
    }
    sections.push("")
  }
  if (delta.added.length > 0) {
    sections.push("## Added", "", ...delta.added.map((item) => `- \`${clip(item.signature)}\` in \`${item.file}\``), "")
  }
  return sections.join("\n")
}

async function capture(args: string[], cwd: string) {
  const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
  const out = await new Response(proc.stdout).text()
  const code = await proc.exited
  return { code, out }
}

export const ApiCommand = effectCmd({
  command: "api [ref]",
  describe: "diff the exported API surface against a git ref",
  instance: false,
  builder: (yargs) =>
    yargs.positional("ref", { describe: "git ref to compare against", type: "string", default: "HEAD" }),
  handler: Effect.fn("Cli.api")(function* (args) {
    const cwd = process.cwd()
    const ref = args.ref
    const check = yield* Effect.promise(() => capture(["rev-parse", "--verify", `${ref}^{commit}`], cwd))
    if (check.code !== 0) return yield* fail(`Not a git ref: ${ref}`)
    const prefix = (yield* Effect.promise(() => capture(["rev-parse", "--show-prefix"], cwd))).out.trim()
    const status = yield* Effect.promise(() => capture(["diff", "--name-status", "--relative", ref], cwd))
    if (status.code !== 0) return yield* fail("git diff failed; run inside a git worktree")
    const rows = status.out
      .split("\n")
      .map((line) => line.split("\t"))
      .filter((parts) => parts.length >= 2)
      .map((parts) => ({ kind: parts[0][0], file: parts[parts.length - 1].replaceAll("\\", "/") }))
      .filter((row) => MATCH.test(row.file) && !row.file.split("/").some((part) => SKIP.has(part)))
    const before: Record<string, string> = {}
    const after: Record<string, string> = {}
    for (const row of rows) {
      if (row.kind !== "A") {
        const shown = yield* Effect.promise(() => capture(["show", `${ref}:${prefix}${row.file}`], cwd))
        if (shown.code === 0) before[row.file] = shown.out
      }
      if (row.kind === "D") continue
      const handle = Bun.file(path.join(cwd, row.file))
      const exists = yield* Effect.promise(() => handle.exists())
      if (exists) after[row.file] = yield* Effect.promise(() => handle.text())
    }
    const delta = diff(surface(before), surface(after))
    process.stdout.write(markdown(delta, ref))
    process.stderr.write(
      `Compared ${rows.length} changed files: ${delta.removed.length} removed, ${delta.changed.length} changed, ${delta.added.length} added\n`,
    )
  }),
})
