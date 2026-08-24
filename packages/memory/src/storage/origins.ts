import path from "path"
import { MemoryFs } from "./fs"

/** Per-fact provenance ledger: which session and message taught each fact, keyed by inventory id.
 * The markdown line grammar carries no metadata, so writes record their origin here and readers
 * (memory why, status surfaces) join it back by id. */
export type Origin = { sessionID?: string; messageID?: string; at: number }

export type Ledger = { version: 1; items: Record<string, Origin> }

export function file(root: string) {
  return path.join(root, "origins.json")
}

function rec(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}

function decodeOrigin(input: unknown): Origin | undefined {
  if (!rec(input)) return undefined
  if (typeof input.at !== "number" || !Number.isFinite(input.at) || input.at < 0) return undefined
  const sessionID = typeof input.sessionID === "string" && input.sessionID ? input.sessionID : undefined
  const messageID = typeof input.messageID === "string" && input.messageID ? input.messageID : undefined
  return {
    at: input.at,
    ...(sessionID ? { sessionID } : {}),
    ...(messageID ? { messageID } : {}),
  }
}

export function parse(input: unknown): Ledger {
  const empty: Ledger = { version: 1, items: {} }
  if (!rec(input) || input.version !== 1 || !rec(input.items)) return empty
  const items: Ledger["items"] = {}
  for (const [id, raw] of Object.entries(input.items)) {
    const item = decodeOrigin(raw)
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

/** Upsert origins for written facts. A rewrite by a new session re-attributes the fact: the ledger
 * always answers "who taught the store its current text". */
export async function record(
  root: string,
  input: { ids: string[]; sessionID?: string; messageID?: string; at: number },
) {
  if (input.ids.length === 0) return
  if (!input.sessionID && !input.messageID) return
  const ledger = await read(root)
  for (const id of input.ids) {
    ledger.items[id] = {
      at: input.at,
      ...(input.sessionID ? { sessionID: input.sessionID } : {}),
      ...(input.messageID ? { messageID: input.messageID } : {}),
    }
  }
  await write(root, ledger)
}

export async function drop(root: string, ids: string[]) {
  if (ids.length === 0) return
  const ledger = await read(root)
  const drops = new Set(ids)
  const remaining = Object.entries(ledger.items).filter(([id]) => !drops.has(id))
  if (remaining.length === Object.keys(ledger.items).length) return
  // Rebuild instead of `delete` on dynamically computed keys.
  await write(root, { version: 1, items: Object.fromEntries(remaining) })
}

export * as MemoryOrigins from "./origins"
