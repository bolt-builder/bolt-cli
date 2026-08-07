import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "fs/promises"
import os from "os"
import path from "path"
import { Memory } from "../src/memory"
import { MemoryOrigins } from "../src/storage/origins"

async function tmp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bolt-memory-origins-"))
  return {
    dir,
    root: path.join(dir, "memory"),
    async done() {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

describe("origin ledger", () => {
  test("parses only well-formed origins", () => {
    const ledger = MemoryOrigins.parse({
      version: 1,
      items: {
        a: { sessionID: "ses_1", messageID: "msg_1", at: 5 },
        b: { at: 6 },
        c: { sessionID: "ses_2", at: "junk" },
        d: "junk",
      },
    })
    expect(Object.keys(ledger.items)).toEqual(["a", "b"])
    expect(ledger.items.a).toEqual({ at: 5, sessionID: "ses_1", messageID: "msg_1" })
    expect(MemoryOrigins.parse(undefined)).toEqual({ version: 1, items: {} })
  })

  test("skips recording when no origin is known", async () => {
    const temp = await tmp()
    try {
      await MemoryOrigins.record(temp.root, { ids: ["a"], at: 1 })
      expect((await MemoryOrigins.read(temp.root)).items).toEqual({})
    } finally {
      await temp.done()
    }
  })
})

describe("write provenance", () => {
  test("links facts to the session and message that taught them", async () => {
    const temp = await tmp()
    try {
      await Memory.enable({ root: temp.root })
      await Memory.remember({
        root: temp.root,
        text: "Deploys go through the release pipeline.",
        sessionID: "ses_teacher",
        messageID: "msg_lesson",
      })

      const taught = await Memory.origins({ root: temp.root })
      const ids = Object.keys(taught.items)
      expect(ids.length).toBe(1)
      const entry = taught.items[ids[0] ?? ""]
      expect(entry?.sessionID).toBe("ses_teacher")
      expect(entry?.messageID).toBe("msg_lesson")
    } finally {
      await temp.done()
    }
  })

  test("re-teaching re-attributes and forgetting drops the origin", async () => {
    const temp = await tmp()
    try {
      await Memory.enable({ root: temp.root })
      await Memory.remember({ root: temp.root, key: "deploy_region", text: "Deploys go to ord.", sessionID: "ses_a" })
      await Memory.remember({ root: temp.root, key: "deploy_region", text: "Deploys go to iad.", sessionID: "ses_b" })

      const taught = await Memory.origins({ root: temp.root })
      const ids = Object.keys(taught.items)
      expect(ids.length).toBe(1)
      expect(taught.items[ids[0] ?? ""]?.sessionID).toBe("ses_b")

      await Memory.forget({ root: temp.root, query: "deploy_region" })
      expect(Object.keys((await Memory.origins({ root: temp.root })).items)).toEqual([])
    } finally {
      await temp.done()
    }
  })

  test("writes without a session leave no origin claim", async () => {
    const temp = await tmp()
    try {
      await Memory.enable({ root: temp.root })
      await Memory.remember({ root: temp.root, text: "An anonymous fact with no teacher." })
      expect(Object.keys((await Memory.origins({ root: temp.root })).items)).toEqual([])
    } finally {
      await temp.done()
    }
  })
})
