export * as ConfigDoctor from "./doctor"

import { isRecord } from "@/util/record"

export type Origin = { source: string; config: Record<string, unknown> }

// Keys that are derived or purely structural, never interesting to attribute.
const HIDDEN = new Set(["$schema", "plugin_origins"])

/** Dot-paths of every leaf value a config object sets. Empty objects count as a leaf at their path. */
export function leaves(value: unknown, path: string[] = []): string[] {
  if (!isRecord(value)) return path.length ? [path.join(".")] : []
  const keys = Object.keys(value).filter((key) => value[key] !== undefined && !(path.length === 0 && HIDDEN.has(key)))
  if (!keys.length) return path.length ? [path.join(".")] : []
  return keys.flatMap((key) => leaves(value[key], [...path, key]))
}

/** Winning source per dot-path after replaying merge order; later origins win each leaf they set. */
export function winners(origins: Origin[]) {
  const result = new Map<string, string>()
  for (const origin of origins) {
    for (const item of leaves(origin.config)) result.set(item, origin.source)
  }
  return result
}

/** Look up the winner for a path, falling back to the nearest ancestor an origin set wholesale. */
export function winner(won: Map<string, string>, path: string) {
  const parts = path.split(".")
  return Array.from({ length: parts.length }, (_, i) => parts.slice(0, parts.length - i).join("."))
    .map((candidate) => won.get(candidate))
    .find((source) => source !== undefined)
}

/** Sources that set a given top-level key, in load order. Useful for concatenated keys like instructions. */
export function contributors(origins: Origin[], key: string) {
  return origins.filter((origin) => origin.config[key] !== undefined).map((origin) => origin.source)
}
