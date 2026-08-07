import { describe, expect, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Installation } from "../../src/installation"
import { UpdateJournal } from "../../src/installation/journal"

function target() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bolt-update-")), "update.json")
}

describe("release channel tags", () => {
  test("stable maps to the latest dist-tag", () => {
    expect(Installation.tag("stable")).toBe("latest")
  })

  test("beta and nightly map to their own dist-tags", () => {
    expect(Installation.tag("beta")).toBe("beta")
    expect(Installation.tag("nightly")).toBe("nightly")
  })
})

describe("update journal", () => {
  test("read returns undefined when missing", async () => {
    expect(await UpdateJournal.read(target())).toBeUndefined()
  })

  test("read returns undefined for malformed entries", async () => {
    const file = target()
    await Bun.write(file, "nope")
    expect(await UpdateJournal.read(file)).toBeUndefined()
    await Bun.write(file, JSON.stringify({ previous: 1 }))
    expect(await UpdateJournal.read(file)).toBeUndefined()
  })

  test("write then read roundtrips", async () => {
    const file = target()
    const entry = { previous: "1.2.0", current: "1.3.0", method: "curl", time: Date.now() }
    await UpdateJournal.write(entry, file)
    expect(await UpdateJournal.read(file)).toEqual(entry)
  })

  test("undo transition recorded by swapping keeps both versions reachable", async () => {
    const file = target()
    await UpdateJournal.write({ previous: "1.2.0", current: "1.3.0", method: "curl", time: 1 }, file)
    const journal = await UpdateJournal.read(file)
    // A rollback installs journal.previous and records the reverse transition.
    await UpdateJournal.write({ previous: "1.3.0", current: journal!.previous, method: "curl", time: 2 }, file)
    const undone = await UpdateJournal.read(file)
    expect(undone!.current).toBe("1.2.0")
    expect(undone!.previous).toBe("1.3.0")
  })
})
