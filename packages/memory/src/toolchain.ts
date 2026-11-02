import { readFile } from "fs/promises"
import path from "path"
import { Memory } from "./memory"

/** Auto-learned build/test commands: deterministic detection from the manifests a repository
 * already has (package.json scripts, Makefile targets, Cargo.toml, go.mod, pyproject.toml,
 * composer.json), persisted into environment.md Commands with zero configuration. */
export type Command = { key: string; text: string; command: string; source: string }

export const manifests = [
  "package.json",
  "bun.lock",
  "bun.lockb",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
  "Makefile",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "uv.lock",
  "composer.json",
]

const SCRIPTS = ["test", "build", "lint", "typecheck", "check", "format", "dev"]

export function manager(files: Record<string, string>) {
  if ("bun.lock" in files || "bun.lockb" in files) return "bun"
  if ("pnpm-lock.yaml" in files) return "pnpm"
  if ("yarn.lock" in files) return "yarn"
  return "npm"
}

function entry(input: { name: string; command: string; source: string }): Command {
  return {
    key: `${input.name}_command`,
    text: `Run ${input.name} with \`${input.command}\` (auto-learned from ${input.source}).`,
    command: input.command,
    source: input.source,
  }
}

// A malformed manifest must never abort detection; it simply contributes nothing.
function json(raw: string | undefined) {
  if (!raw?.trim()) return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

function fields(input: unknown, name: string) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return
  const found = (input as Record<string, unknown>)[name]
  if (typeof found !== "object" || found === null || Array.isArray(found)) return
  return found as Record<string, unknown>
}

function scripts(files: Record<string, string>): Command[] {
  const found = fields(json(files["package.json"]), "scripts")
  if (!found) return []
  const pm = manager(files)
  return SCRIPTS.filter((name) => typeof found[name] === "string").map((name) =>
    entry({ name, command: `${pm} run ${name}`, source: "package.json" }),
  )
}

function make(files: Record<string, string>): Command[] {
  const raw = files["Makefile"]
  if (!raw) return []
  return SCRIPTS.filter((name) => new RegExp(`^${name}\\s*:`, "m").test(raw)).map((name) =>
    entry({ name, command: `make ${name}`, source: "Makefile" }),
  )
}

function cargo(files: Record<string, string>): Command[] {
  if (!("Cargo.toml" in files)) return []
  return [
    entry({ name: "test", command: "cargo test", source: "Cargo.toml" }),
    entry({ name: "build", command: "cargo build", source: "Cargo.toml" }),
  ]
}

function golang(files: Record<string, string>): Command[] {
  if (!("go.mod" in files)) return []
  return [
    entry({ name: "test", command: "go test ./...", source: "go.mod" }),
    entry({ name: "build", command: "go build ./...", source: "go.mod" }),
  ]
}

function python(files: Record<string, string>): Command[] {
  const raw = files["pyproject.toml"]
  if (!raw || !raw.includes("pytest")) return []
  const command = "uv.lock" in files ? "uv run pytest" : "pytest"
  return [entry({ name: "test", command, source: "pyproject.toml" })]
}

function composer(files: Record<string, string>): Command[] {
  const found = fields(json(files["composer.json"]), "scripts")
  if (!found) return []
  return SCRIPTS.filter((name) => found[name] !== undefined).map((name) =>
    entry({ name, command: `composer run-script ${name}`, source: "composer.json" }),
  )
}

/** Pure detection over manifest contents keyed by filename. The first ecosystem to claim a command
 * key wins, in the order a polyglot repo most likely treats as primary. */
export function detect(input: { files: Record<string, string> }): Command[] {
  const seen = new Set<string>()
  return [
    ...scripts(input.files),
    ...make(input.files),
    ...cargo(input.files),
    ...golang(input.files),
    ...python(input.files),
    ...composer(input.files),
  ].filter((item) => {
    if (seen.has(item.key)) return false
    seen.add(item.key)
    return true
  })
}

export async function scan(worktree: string) {
  const files: Record<string, string> = {}
  for (const name of manifests) {
    const text = await readFile(path.join(worktree, name), "utf8").catch(() => undefined)
    if (text !== undefined) files[name] = text
  }
  return files
}

/** Detect toolchain commands in the worktree and persist them into environment.md Commands. */
export async function learn(input: { root: string; worktree: string; sessionID?: string }) {
  const found = detect({ files: await scan(input.worktree) })
  if (found.length === 0) return { entries: found, applied: 0 }
  const result = await Memory.apply({
    root: input.root,
    sessionID: input.sessionID,
    ops: found.map((item) => ({
      action: "add",
      file: "environment.md",
      section: "Commands",
      key: item.key,
      text: item.text,
    })),
  })
  return { entries: found, applied: result.result.operationCount }
}

export * as MemoryToolchain from "./toolchain"
