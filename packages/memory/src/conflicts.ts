import type { MemoryOperations } from "./capture/operations"
import { MemoryText } from "./text"
import { MemoryTopics } from "./recall/topics"

/** Pure conflict detection over stored facts: contradictory polarity, duplicate keys across
 * sections, and corrections that supersede an older fact still on record. */
export type Item = {
  id: string
  file: string
  section: string
  key: string
  text: string
  updatedAt?: number
}

export type Reason = "polarity" | "duplicate" | "correction"

export type Conflict = { reason: Reason; left: Item; right: Item }

export type Resolution = {
  conflict: Conflict
  keep: Item
  drop: Item
  op: MemoryOperations.Remove
}

export type Plan = { resolutions: Resolution[]; unresolved: Conflict[] }

/** Minimum shared subject terms before two facts are considered to talk about the same thing. */
export const MIN_OVERLAP = 3

/** Corrections overlap their subject by construction, so superseding needs a stronger anchor. */
export const CORRECTION_OVERLAP = 4

const NEGATIVE = /\b(never|not|no|don'?t|doesn'?t|do not|avoid|stop|disallow|forbidden|without)\b/i

export function negative(text: string) {
  return NEGATIVE.test(text)
}

export function overlap(a: string, b: string) {
  const right = MemoryTopics.words(b)
  const found = new Set(right)
  return MemoryTopics.words(a).filter(
    (term) => found.has(term) || right.some((item) => MemoryTopics.related(item, term)),
  ).length
}

function correction(item: Item) {
  return item.file === "corrections.md"
}

function classify(left: Item, right: Item): Reason | undefined {
  const differs = MemoryText.normalized(left.text) !== MemoryText.normalized(right.text)
  const shared = overlap(left.text, right.text)
  // A correction paired with a non-correction supersedes it, even when the derived keys collide.
  if (correction(left) !== correction(right) && (shared >= CORRECTION_OVERLAP || (left.key === right.key && differs)))
    return "correction"
  if (left.key === right.key && differs) return "duplicate"
  if (negative(left.text) !== negative(right.text) && shared >= MIN_OVERLAP) return "polarity"
  return
}

export function detect(items: Item[]): Conflict[] {
  const out: Conflict[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const left = items[i]!
      const right = items[j]!
      if (left.id === right.id) continue
      const reason = classify(left, right)
      if (reason) out.push({ reason, left, right })
    }
  }
  return out
}

function pick(conflict: Conflict): Item | undefined {
  if (conflict.reason === "correction") return correction(conflict.left) ? conflict.left : conflict.right
  const left = conflict.left.updatedAt ?? 0
  const right = conflict.right.updatedAt ?? 0
  // Without a usable age difference there is no safe automatic winner; leave it to a human.
  if (left === right || (!conflict.left.updatedAt && !conflict.right.updatedAt)) return
  return left > right ? conflict.left : conflict.right
}

/** Pure resolution planning: corrections beat the facts they supersede, otherwise the newer fact
 * wins. Each losing fact is dropped at most once; ties stay unresolved for manual review. */
export function resolve(conflicts: Conflict[]): Plan {
  const resolutions: Resolution[] = []
  const unresolved: Conflict[] = []
  const dropped = new Set<string>()
  for (const conflict of conflicts) {
    const keep = pick(conflict)
    if (!keep) {
      unresolved.push(conflict)
      continue
    }
    const drop = keep === conflict.left ? conflict.right : conflict.left
    if (dropped.has(drop.id)) continue
    dropped.add(drop.id)
    resolutions.push({
      conflict,
      keep,
      drop,
      op: { action: "remove", query: `${drop.file}:${drop.section}:${drop.key}` },
    })
  }
  return { resolutions, unresolved }
}

export * as MemoryConflicts from "./conflicts"
