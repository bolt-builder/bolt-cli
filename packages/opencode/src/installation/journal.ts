export * as UpdateJournal from "./journal"

import path from "node:path"
import { Global } from "@opencode-ai/core/global"

// Records the last completed update so `bolt update --undo` can roll back to
// the previously installed version through the normal install path.
export const file = path.join(Global.Path.state, "update.json")

export interface Entry {
  previous: string
  current: string
  method: string
  time: number
}

export async function read(target = file): Promise<Entry | undefined> {
  const data: unknown = await Bun.file(target)
    .json()
    .catch(() => undefined)
  if (!data || typeof data !== "object") return undefined
  const entry = data as Record<string, unknown>
  if (typeof entry.previous !== "string") return undefined
  if (typeof entry.current !== "string") return undefined
  if (typeof entry.method !== "string") return undefined
  if (typeof entry.time !== "number") return undefined
  return { previous: entry.previous, current: entry.current, method: entry.method, time: entry.time }
}

export async function write(entry: Entry, target = file) {
  await Bun.write(target, JSON.stringify(entry, null, 2))
}
