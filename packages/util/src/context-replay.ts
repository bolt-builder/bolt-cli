export * as ContextReplay from "./context-replay.js"

import fs from "node:fs/promises"
import path from "node:path"

function segment(value: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,255}$/.test(value)) throw new Error("Invalid context replay identifier")
  return value
}

export function directory(sessionID: string, base: string) {
  return path.join(base, "replay", segment(sessionID))
}

export async function record(
  input: { sessionID: string; messageID: string; time: number },
  data: unknown,
  base: string,
) {
  const dir = directory(input.sessionID, base)
  segment(input.messageID)
  if (!Number.isSafeInteger(input.time) || input.time < 0) throw new Error("Invalid context replay timestamp")
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  const target = path.join(dir, `${input.time}-${input.messageID}-${crypto.randomUUID()}.json`)
  const file = await fs.open(target, "wx", 0o600)
  try {
    await file.writeFile(JSON.stringify(data, null, 2) + "\n")
  } finally {
    await file.close()
  }
  return target
}

export async function list(sessionID: string, bases: readonly string[]) {
  const entries = new Map<string, { name: string; base: string }>()
  for (const base of bases) {
    const dir = directory(sessionID, base)
    const names = await fs.readdir(dir).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return []
      throw error
    })
    for (const name of names) {
      if (/^\d+-[A-Za-z0-9_-]+\.json$/.test(name)) entries.set(name, { name, base })
    }
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function load(sessionID: string, entry: { name: string; base: string }) {
  if (!/^\d+-[A-Za-z0-9_-]+\.json$/.test(entry.name)) throw new Error("Invalid context replay filename")
  return Bun.file(path.join(directory(sessionID, entry.base), entry.name)).json() as Promise<unknown>
}
