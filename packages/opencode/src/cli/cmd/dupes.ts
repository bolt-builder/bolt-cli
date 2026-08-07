import path from "node:path"
import { Effect } from "effect"
import { effectCmd } from "../effect-cmd"

const SKIP = new Set([".git", "node_modules", "dist", "build", ".turbo"])
const WINDOW = 6
const LIMIT = 20

export type Row = { line: number; text: string }
export type Site = { file: string; start: number; end: number }
export type Cluster = { sites: Site[]; lines: number }

/**
 * Normalizes source into comparable rows: comments stripped, whitespace
 * collapsed, string and numeric literals replaced with placeholders so
 * near-identical code (same shape, different literals) hashes equally.
 * Blank rows are dropped; each row keeps its original 1-based line number.
 */
export function normalize(text: string) {
  const rows: Row[] = []
  let block = false
  text.split("\n").forEach((raw, index) => {
    const closed = block ? raw.replace(/^.*?\*\//, "") : raw
    const open = block && !/\*\//.test(raw)
    block = open || /\/\*(?!.*\*\/)/.test(closed)
    const body = open
      ? ""
      : closed
          .replace(/\/\*.*?\*\//g, "")
          .replace(/\/\*.*$/, "")
          .replace(/\/\/.*$/, "")
          .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "S")
          .replace(/\b\d[\w.]*/g, "N")
          .replace(/\s+/g, " ")
          .trim()
    if (body === "" || body === "}" || body === "};" || body === "{") return
    rows.push({ line: index + 1, text: body })
  })
  return rows
}

/**
 * Finds clusters of near-identical code: windows of `window` normalized rows
 * that appear at two or more distinct sites. Groups fully covered by their
 * predecessor window are subsumed, and surviving groups are extended forward
 * to maximal length, so a long duplicate reports once instead of per offset.
 */
export function clusters(files: Record<string, string>, window = WINDOW) {
  const names = Object.keys(files).sort()
  const rows = new Map(names.map((name) => [name, normalize(files[name])]))
  const keys = new Map<string, string[]>()
  for (const name of names) {
    const list = rows.get(name) ?? []
    const texts = list.map((row) => row.text)
    keys.set(
      name,
      texts.map((_, index) => (index + window <= texts.length ? texts.slice(index, index + window).join("\n") : "")),
    )
  }
  const groups = new Map<string, { file: string; index: number }[]>()
  for (const name of names) {
    const list = keys.get(name) ?? []
    list.forEach((key, index) => {
      if (key === "") return
      const found = groups.get(key)
      if (found) {
        found.push({ file: name, index })
        return
      }
      groups.set(key, [{ file: name, index }])
    })
  }
  const results: Cluster[] = []
  for (const members of groups.values()) {
    if (members.length < 2) continue
    if (subsumed(members, keys)) continue
    const length = extent(members, keys, window)
    const sites = members.map((member) => {
      const list = rows.get(member.file) ?? []
      return { file: member.file, start: list[member.index].line, end: list[member.index + length - 1].line }
    })
    results.push({ sites: dedupe(sites), lines: length })
  }
  return results
    .filter((cluster) => cluster.sites.length > 1)
    .sort((a, b) => b.lines * b.sites.length - a.lines * a.sites.length || compare(a, b))
}

/** True when every member's preceding window exists and all share one key, meaning a longer cluster already covers this one. */
function subsumed(members: { file: string; index: number }[], keys: Map<string, string[]>) {
  const previous = members.map((member) => (member.index > 0 ? (keys.get(member.file) ?? [])[member.index - 1] : ""))
  if (previous.some((key) => key === "" || key === undefined)) return false
  return new Set(previous).size === 1
}

/** Number of normalized rows the cluster spans once extended while every member keeps matching. */
function extent(members: { file: string; index: number }[], keys: Map<string, string[]>, window: number) {
  let offset = 1
  while (true) {
    const next = members.map((member) => (keys.get(member.file) ?? [])[member.index + offset])
    if (next.some((key) => key === "" || key === undefined)) break
    if (new Set(next).size !== 1) break
    offset += 1
  }
  return window + offset - 1
}

function dedupe(sites: Site[]) {
  const unique = new Map(sites.map((site) => [`${site.file}\u0000${site.start}`, site]))
  return [...unique.values()].sort((a, b) => a.file.localeCompare(b.file) || a.start - b.start)
}

function compare(a: Cluster, b: Cluster) {
  return `${a.sites[0].file}:${a.sites[0].start}`.localeCompare(`${b.sites[0].file}:${b.sites[0].start}`)
}

/** Renders ranked clusters as markdown, capped at `limit` entries. */
export function markdown(results: Cluster[], limit = LIMIT) {
  if (results.length === 0) return "# Duplicate logic\n\nNo near-identical blocks found.\n"
  const sections = results.slice(0, limit).flatMap((cluster, index) => [
    `## ${index + 1}. ${cluster.sites.length} sites, ~${cluster.lines} lines each`,
    "",
    ...cluster.sites.map((site) => `- \`${site.file}:${site.start}-${site.end}\``),
    "",
  ])
  return ["# Duplicate logic", "", `${results.length} clusters found.`, "", ...sections].join("\n")
}

export const DupesCommand = effectCmd({
  command: "dupes",
  describe: "find near-identical code blocks across the repo",
  instance: false,
  builder: (yargs) =>
    yargs
      .option("window", {
        describe: "minimum duplicate size in normalized lines",
        type: "number",
        default: WINDOW,
      })
      .option("limit", {
        describe: "maximum clusters to report",
        type: "number",
        default: LIMIT,
      }),
  handler: Effect.fn("Cli.dupes")(function* (args) {
    const cwd = process.cwd()
    const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx}")
    const scanned = yield* Effect.promise(() => Array.fromAsync(glob.scan({ cwd })))
    const names = scanned
      .map((name) => name.replaceAll("\\", "/"))
      .filter((name) => !name.split("/").some((part) => SKIP.has(part)))
      .sort()
    const files: Record<string, string> = {}
    for (const name of names) {
      files[name] = yield* Effect.promise(() => Bun.file(path.join(cwd, name)).text())
    }
    const window = Math.max(3, Math.floor(args.window))
    const found = clusters(files, window)
    process.stdout.write(markdown(found, Math.max(1, Math.floor(args.limit))))
    process.stderr.write(`Scanned ${names.length} files, found ${found.length} duplicate clusters\n`)
  }),
})
