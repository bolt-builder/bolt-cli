/**
 * Codex-style per-session memory controls, stored in the host session's metadata record
 * (the same place as other per-session flags like the sandbox toggle).
 *
 * Both controls default to on whenever the memory feature is enabled; only an explicit
 * `false` opts the session out, so untouched sessions keep full memory behavior.
 */

export const USE = "memoryUse"
export const CONTRIBUTE = "memoryContribute"

/** True when the session may use saved memories: index injection and targeted recall. */
export function use(metadata: Record<string, unknown> | null | undefined) {
  return metadata?.[USE] !== false
}

/** True when the session may contribute to future memory generation: turn-close capture and saves. */
export function contribute(metadata: Record<string, unknown> | null | undefined) {
  return metadata?.[CONTRIBUTE] !== false
}

export * as MemoryControls from "./controls"
