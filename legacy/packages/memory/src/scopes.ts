import { stat } from "fs/promises"
import path from "path"

/** Per-directory memory scopes for monorepos. Scoped facts stay in the shared project store but
 * live under a `Scope: <dir>` section, so every existing write/remove/index path keeps working;
 * recall narrows to the scopes that apply to the directory Bolt was opened in. */
export const PREFIX = "Scope: "

export const markers = [
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "composer.json",
  "Gemfile",
  "pom.xml",
  "build.gradle",
]

export function clean(scope: string) {
  const value = scope
    .trim()
    .replaceAll("\\", "/")
    .replaceAll(/\/+/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .trim()
  if (value === ".") return ""
  return value
}

export function section(scope: string) {
  return `${PREFIX}${clean(scope)}`
}

export function parse(input: string) {
  if (!input.startsWith(PREFIX)) return
  return clean(input.slice(PREFIX.length))
}

function relative(worktree: string, directory: string) {
  const value = path.relative(worktree, directory)
  if (!value) return ""
  if (value.startsWith("..") || path.isAbsolute(value)) return
  return value.replaceAll("\\", "/")
}

/** A fact scoped to a directory applies at that directory and below; the repo root sees everything. */
export function applies(input: { scope: string; active?: string }) {
  const fact = clean(input.scope)
  if (!fact) return true
  const active = clean(input.active ?? "")
  if (!active) return true
  return active === fact || active.startsWith(`${fact}/`)
}

/** Pure scope resolution: the deepest known scope root containing the directory wins. */
export function resolve(input: { directory: string; worktree: string; roots: string[] }) {
  const rel = relative(input.worktree, input.directory)
  if (rel === undefined || rel === "") return ""
  const found = input.roots
    .map(clean)
    .filter((root) => root && (rel === root || rel.startsWith(`${root}/`)))
    .sort((a, b) => b.length - a.length)
  return found[0] ?? ""
}

/** Discover the active scope by walking from the directory up to the worktree root, returning the
 * deepest ancestor that carries a package marker. The worktree root itself is scope "". */
export async function locate(input: { directory: string; worktree: string }) {
  const rel = relative(input.worktree, input.directory)
  if (!rel) return ""
  const parts = rel.split("/")
  for (let depth = parts.length; depth >= 1; depth--) {
    const scope = parts.slice(0, depth).join("/")
    for (const marker of markers) {
      const found = await stat(path.join(input.worktree, scope, marker)).then(
        (info) => info.isFile(),
        () => false,
      )
      if (found) return scope
    }
  }
  return ""
}

export * as MemoryScopes from "./scopes"
