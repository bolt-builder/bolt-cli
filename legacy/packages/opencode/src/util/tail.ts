import fs from "node:fs"
import path from "node:path"

// Streams bytes appended to an append-only file to stdout. Reads are
// serialized so a burst of writes cannot spawn concurrent read streams that
// interleave their chunks out of order. With a line filter, chunks are
// buffered into whole lines first so a predicate never sees a partial line.
export function follow(file: string, initialOffset: number, filter?: (line: string) => boolean) {
  let offset = initialOffset
  let draining = false
  let pending = ""
  const emit = (chunk: string) => {
    if (!filter) return void process.stdout.write(chunk)
    pending += chunk
    const lines = pending.split("\n")
    pending = lines.pop() ?? ""
    for (const line of lines) {
      if (filter(line)) process.stdout.write(line + "\n")
    }
  }
  const drain = () => {
    if (draining) return
    const size = fs.statSync(file, { throwIfNoEntry: false })?.size ?? 0
    if (size <= offset) {
      offset = size
      return
    }
    draining = true
    const stream = fs.createReadStream(file, { start: offset, end: size - 1, encoding: "utf8" })
    offset = size
    stream.on("data", (chunk) => emit(chunk as string))
    // The file may rotate or truncate mid-read; drop the failed read and
    // resume from the next watch event instead of crashing on an unhandled
    // stream error.
    stream.on("error", () => {})
    stream.on("close", () => {
      draining = false
      drain()
    })
  }
  const watcher = fs.watch(path.dirname(file), (_, name) => {
    if (name !== path.basename(file)) return
    drain()
  })
  return () => watcher.close()
}

export * as Tail from "./tail"
