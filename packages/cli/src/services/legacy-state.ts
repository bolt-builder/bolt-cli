import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "@opencode/util/global"
import { Flock } from "@opencode/util/flock"

/** Import persisted metadata once; do not start jobs or rewrite their original log paths. */
export async function restoreState(
  kind: "jobs" | "cron",
  decode: (text: string) => { readonly id: string } | undefined,
) {
  const legacy = Global.boltDirectory(Global.Path.state)
  if (!legacy) return
  const source = path.join(legacy, kind)
  const files = await fs.readdir(source).catch((error) => {
    if (error.code === "ENOENT") return []
    throw error
  })
  if (!files.length) return
  const directory = path.join(Global.Path.state, kind)
  const marker = path.join(directory, ".bolt-v1-imported")
  const lock = await Flock.acquire(marker)
  try {
    if (await Bun.file(marker).exists()) return
    await fs.mkdir(directory, { recursive: true })
    const imported: string[] = []
    const records: { id: string; file: string; text: string }[] = []
    for (const file of files.filter((file) => file.endsWith(".json"))) {
      const text = await fs.readFile(path.join(source, file), "utf8")
      const record = decode(text)
      if (!record || !/^[a-zA-Z0-9_-]+$/.test(record.id) || file !== `${record.id}.json`)
        throw new Error(`Invalid V1 ${kind} record: ${path.join(source, file)}; source retained`)
      records.push({ id: record.id, file, text })
    }
    // Validate the entire source before writing, so a malformed record can be
    // repaired and retried without leaving a partially imported set.
    for (const record of records) {
      const created = await fs
        .writeFile(path.join(directory, record.file), record.text, { flag: "wx", mode: 0o600 })
        .then(() => true)
        .catch((error) => {
          if (error.code !== "EEXIST") throw error
          return false
        })
      if (created) imported.push(record.id)
    }
    await fs.writeFile(marker, JSON.stringify(imported) + "\n", { mode: 0o600 })
  } finally {
    await lock.release()
  }
}
