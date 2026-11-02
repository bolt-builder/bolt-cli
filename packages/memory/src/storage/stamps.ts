import path from "path"
import { MemoryFs } from "./fs"

/** Per-fact timestamp ledger. Source markdown carries no per-line times (inventory times are
 * mtime-derived), so writes record real created/updated stamps here keyed by inventory id. */
export type Stamp = { createdAt: number; updatedAt: number }

export type Ledger = { version: 1; items: Record<string, Stamp> }

export function file(root: string) {
  return path.join(root, "stamps.json")
}

function stamp(input: unknown): Stamp | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return
  const value = input as Record<string, unknown>
  const created = value.createdAt
  const updated = value.updatedAt
  if (typeof created !== "number" || !Number.isFinite(created) || created < 0) return
  if (typeof updated !== "number" || !Number.isFinite(updated) || updated < 0) return
  return { createdAt: created, updatedAt: updated }
}

export function parse(input: unknown): Ledger {
  const empty: Ledger = { version: 1, items: {} }
  if (typeof input !== "object" || input === null || Array.isArray(input)) return empty
  const value = input as Record<string, unknown>
  if (value.version !== 1) return empty
  if (typeof value.items !== "object" || value.items === null || Array.isArray(value.items)) return empty
  const items: Ledger["items"] = {}
  for (const [id, raw] of Object.entries(value.items)) {
    const item = stamp(raw)
    if (item) items[id] = item
  }
  return { version: 1, items }
}

export async function read(root: string): Promise<Ledger> {
  const data = await MemoryFs.json(file(root)).catch((error: unknown) => {
    if (MemoryFs.miss(error) || MemoryFs.parse(error)) return undefined
    throw error
  })
  return parse(data)
}

export async function write(root: string, ledger: Ledger) {
  await MemoryFs.write(file(root), `${JSON.stringify(ledger)}\n`)
}

/** Upsert stamps for written facts: reconfirming an existing fact refreshes updatedAt and keeps createdAt. */
export async function record(root: string, input: { ids: string[]; now: number }) {
  if (input.ids.length === 0) return
  const ledger = await read(root)
  for (const id of input.ids) {
    const prior = ledger.items[id]
    ledger.items[id] = { createdAt: prior?.createdAt ?? input.now, updatedAt: input.now }
  }
  await write(root, ledger)
}

export async function drop(root: string, ids: string[]) {
  if (ids.length === 0) return
  const ledger = await read(root)
  const found = ids.filter((id) => ledger.items[id] !== undefined)
  if (found.length === 0) return
  for (const id of found) delete ledger.items[id]
  await write(root, ledger)
}

export * as MemoryStamps from "./stamps"
