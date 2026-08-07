import { Wildcard } from "@opencode-ai/core/util/wildcard"

/**
 * Return the first protected-path pattern matching a worktree-relative path,
 * or undefined when the path is not protected. A pattern also protects
 * everything beneath a matching directory, so "secrets" covers "secrets/key.pem".
 */
export function match(relative: string, patterns?: readonly string[]) {
  if (!patterns) return undefined
  return patterns.find((pattern) => {
    const trimmed = pattern.replace(/\/+$/, "")
    if (trimmed.length === 0) return false
    return Wildcard.match(relative, trimmed) || Wildcard.match(relative, `${trimmed}/*`)
  })
}

export * as Protection from "."
