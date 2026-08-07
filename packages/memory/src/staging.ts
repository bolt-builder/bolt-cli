import path from "path"
import { MemoryFs } from "./storage/fs"
import type { MemoryOperations } from "./capture/operations"
import { MemorySlug } from "./slug"
import type { MemorySources } from "./storage/sources"

/** Review staging for auto-captured memory: when review mode is on, non-explicit writes queue in
 * pending.json instead of persisting, so a session's additions can be diffed, approved, or
 * discarded before they reach the store. Explicit saves are deliberate and never staged. */
export type Pending = { op: MemoryOperations.Op; sessionID?: string; at: number }

export type Store = { version: 1; review: boolean; items: Pending[] }

export function file(root: string) {
  return path.join(root, "pending.json")
}

function rec(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}

function op(input: unknown): MemoryOperations.Op | undefined {
  if (!rec(input)) return
  if (input.action === "remove" && typeof input.query === "string" && input.query.trim()) {
    return { action: "remove", query: input.query }
  }
  if (input.action !== "add") return
  if (typeof input.key !== "string" || typeof input.text !== "string") return
  if (!input.key.trim() || !input.text.trim()) return
  return {
    action: "add",
    key: input.key,
    text: input.text,
    ...(typeof input.file === "string" ? { file: input.file as MemoryOperations.Add["file"] } : {}),
    ...(typeof input.section === "string" ? { section: input.section } : {}),
  }
}

export function parse(input: unknown): Store {
  const empty: Store = { version: 1, review: false, items: [] }
  if (!rec(input) || input.version !== 1) return empty
  const items = Array.isArray(input.items)
    ? input.items.flatMap((item): Pending[] => {
        if (!rec(item)) return []
        const value = op(item.op)
        if (!value) return []
        return [
          {
            op: value,
            at: typeof item.at === "number" && Number.isFinite(item.at) ? item.at : 0,
            ...(typeof item.sessionID === "string" ? { sessionID: item.sessionID } : {}),
          },
        ]
      })
    : []
  return { version: 1, review: input.review === true, items }
}

export async function read(root: string): Promise<Store> {
  const data = await MemoryFs.json(file(root)).catch((error: unknown) => {
    if (MemoryFs.miss(error) || MemoryFs.parse(error)) return undefined
    throw error
  })
  return parse(data)
}

export async function write(root: string, store: Store) {
  await MemoryFs.write(file(root), `${JSON.stringify(store)}\n`)
}

export async function enabled(root: string) {
  const store = await read(root)
  return store.review
}

export async function configure(root: string, input: { review: boolean }) {
  const store = await read(root)
  const next = { ...store, review: input.review }
  await write(root, next)
  return next
}

export async function stage(root: string, input: { ops: MemoryOperations.Op[]; sessionID?: string; now: number }) {
  const store = await read(root)
  const items = [
    ...store.items,
    ...input.ops.map((item) => ({ op: item, sessionID: input.sessionID, at: input.now })),
  ]
  const next = { ...store, items }
  await write(root, next)
  return { count: input.ops.length, total: items.length }
}

export async function clear(root: string) {
  const store = await read(root)
  const next = { ...store, items: [] as Pending[] }
  await write(root, next)
  return store.items.length
}

// Mirror the normalization apply uses so the diff matches what an approval would actually touch.
function slug(input: string) {
  const value = MemorySlug.safe(input.trim(), { max: MemorySlug.max.key, fallback: "", lower: true })
  return value || MemorySlug.hash(input, "memory")
}

function heading(input: MemoryOperations.Add) {
  const value = input.section?.trim()
  if (value) return value
  if (input.file === "environment.md") return "Commands"
  if (input.file === "corrections.md") return "Corrections"
  return "Facts"
}

/** Pure diff rendering: what the store would gain (+), update (~ with the current text), or keep
 * unchanged (=) if the pending queue were approved, resolved against the current inventory. */
export function render(input: { items: Pending[]; inventory: MemorySources.Inventory }) {
  return input.items.map((item) => {
    const from = item.sessionID ? ` (session ${item.sessionID})` : ""
    if (item.op.action === "remove") return `- forget: ${item.op.query}${from}`
    const file = item.op.file ?? "project.md"
    const key = slug(item.op.key)
    const label = `${file} > ${heading(item.op)} > ${key}`
    const prior = Object.values(input.inventory.items).find((it) => it.file === file && it.key === key)
    if (!prior) return `+ ${label} :: ${item.op.text}${from}`
    if (prior.text === item.op.text) return `= ${label} :: ${item.op.text}${from}`
    return `~ ${label} :: ${item.op.text} (was: ${prior.text})${from}`
  })
}

export * as MemoryStaging from "./staging"
