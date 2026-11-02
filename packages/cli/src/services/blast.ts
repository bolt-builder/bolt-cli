export interface Change {
  path: string
  additions: number
  deletions: number
  binary: boolean
}

/**
 * Parse `git diff --numstat -z` output into per-file changes. Binary files report `-` counts.
 * NUL-terminated records keep literal filenames unambiguous: a rename leaves the path field
 * empty and follows with the old and new paths as separate records.
 */
export function parse(numstat: string): Change[] {
  const fields = numstat.split("\0")
  const changes: Change[] = []
  for (let index = 0; index < fields.length; index++) {
    const match = fields[index].match(/^(\d+|-)\t(\d+|-)\t(.*)$/s)
    if (!match) continue
    const rename = match[3] === ""
    const path = rename ? fields[index + 2] : match[3]
    if (rename) index += 2
    if (!path) continue
    const binary = match[1] === "-" || match[2] === "-"
    changes.push({
      path,
      additions: binary ? 0 : Number(match[1]),
      deletions: binary ? 0 : Number(match[2]),
      binary,
    })
  }
  return changes
}

/** Classify a changed path so the report can separate behavior changes from tests, docs, and config. */
export function kind(path: string) {
  if (/(^|\/)test\//.test(path) || /\.(test|spec)\.[a-z]+$/.test(path)) return "test" as const
  if (/\.(md|mdx|txt)$/i.test(path)) return "docs" as const
  if (/\.(json|jsonc|ya?ml|toml|lock|lockb)$/.test(path) || /(^|\/)\.[^/]+$/.test(path)) return "config" as const
  return "source" as const
}

/** Map a path to its workspace package, or "root" for files outside packages/. */
export function pkg(path: string) {
  const match = path.match(/^packages\/([^/]+)\//)
  if (match) return match[1]
  return "root"
}

/**
 * Import stem used to estimate dependents: the filename without extension,
 * or the directory name for index files (imported as the directory).
 */
export function stem(path: string) {
  const segments = path.split("/")
  const name = segments.at(-1)!.replace(/\.[^.]+$/, "")
  const candidates = [name, ...segments.slice(0, -1).reverse()]
  return candidates.find((item) => item !== "index" && item !== "src") ?? name
}

/** Coarse risk grade from the shape of the change, biased toward flagging wide blast radii. */
export function risk(input: { source: number; tests: number; packages: number; dependents: number }) {
  if (input.dependents >= 20 || input.source >= 20 || input.packages >= 3) return "high" as const
  if (input.dependents >= 5 || input.source >= 5 || input.packages >= 2) return "medium" as const
  return "low" as const
}

export * as Blast from "./blast"
