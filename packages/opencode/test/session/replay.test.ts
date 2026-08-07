import { describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs/promises"
import os from "os"
import { SessionReplay } from "@/session/replay"

const input = {
  sessionID: "ses_test",
  messageID: "msg_user",
  time: 1_700_000_000_000,
  providerID: "anthropic",
  modelID: "claude-test",
  system: ["env section", "instructions section"],
  messages: [{ role: "user" as const, content: "hello" }],
  tools: ["write", "bash", "edit"],
}

describe("session.replay.serialize", () => {
  test("captures the prepared request", () => {
    const record = SessionReplay.serialize(input)
    expect(record.version).toBe(1)
    expect(record.sessionID).toBe("ses_test")
    expect(record.messageID).toBe("msg_user")
    expect(record.model).toEqual({ providerID: "anthropic", modelID: "claude-test" })
    expect(record.system).toEqual(["env section", "instructions section"])
    expect(record.messages).toEqual([{ role: "user", content: "hello" }])
  })

  test("sorts tool names for stable diffs", () => {
    expect(SessionReplay.serialize(input).tools).toEqual(["bash", "edit", "write"])
  })
})

describe("session.replay.record", () => {
  test("roundtrips through record, list, and load", async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-replay-"))
    await SessionReplay.record(input, base)
    await SessionReplay.record({ ...input, time: input.time + 1 }, base)

    const entries = await SessionReplay.list("ses_test", base)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toBe("1700000000000-msg_user.json")

    const loaded = await SessionReplay.load("ses_test", entries[0], base)
    expect(loaded).toEqual(SessionReplay.serialize(input))
    await fs.rm(base, { recursive: true, force: true })
  })

  test("lists nothing for sessions without recordings", async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-replay-"))
    expect(await SessionReplay.list("ses_missing", base)).toEqual([])
    await fs.rm(base, { recursive: true, force: true })
  })
})
