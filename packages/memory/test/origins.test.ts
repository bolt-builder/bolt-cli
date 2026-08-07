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
    const t = await tmp()
    try {
      await MemoryOrigins.record(t.root, { ids: ["a"], at: 1 })
      expect((await MemoryOrigins.read(t.root)).items).toEqual({})
    } finally {
      await t.done()
    }
  })
})

describe("write provenance", () => {
  test("links facts to the session and message that taught them", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.remember({
        root: t.root,
        text: "Deploys go through the release pipeline.",
        sessionID: "ses_teacher",
        messageID: "msg_lesson",
      })

      const taught = await Memory.origins({ root: t.root })
      const ids = Object.keys(taught.items)
      expect(ids.length).toBe(1)
      expect(taught.items[ids[0]!]!.sessionID).toBe("ses_teacher")
      expect(taught.items[ids[0]!]!.messageID).toBe("msg_lesson")
    } finally {
      await t.done()
    }
  })

  test("re-teaching re-attributes and forgetting drops the origin", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.remember({ root: t.root, key: "deploy_region", text: "Deploys go to ord.", sessionID: "ses_a" })
      await Memory.remember({ root: t.root, key: "deploy_region", text: "Deploys go to iad.", sessionID: "ses_b" })

      const taught = await Memory.origins({ root: t.root })
      const ids = Object.keys(taught.items)
      expect(ids.length).toBe(1)
      expect(taught.items[ids[0]!]!.sessionID).toBe("ses_b")

      await Memory.forget({ root: t.root, query: "deploy_region" })
      expect(Object.keys((await Memory.origins({ root: t.root })).items)).toEqual([])
    } finally {
      await t.done()
    }
  })

  test("writes without a session leave no origin claim", async () => {
    const t = await tmp()
    try {
      await Memory.enable({ root: t.root })
      await Memory.remember({ root: t.root, text: "An anonymous fact with no teacher." })
      expect(Object.keys((await Memory.origins({ root: t.root })).items)).toEqual([])
    } finally {
      await t.done()
    }
  })
})
