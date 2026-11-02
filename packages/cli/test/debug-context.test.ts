import { expect, test } from "bun:test"
import { ContextReplay } from "@opencode/util/context-replay"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("debug context lists and loads V1/V2 recorded inputs without a server, preserving both stores", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-debug-context-"))
  const current = path.join(home, "data", "opencode")
  const legacy = path.join(home, "data", "bolt")
  const env = isolatedEnv(home)
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, "debug", "context", ...args],
      { cwd: home, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  try {
    const empty = await cli("ses_example")
    expect(empty.code).toBe(1)
    expect(empty.stderr).toContain("experimental.context_replay")
    await fs.mkdir(ContextReplay.directory("ses_example", legacy), { recursive: true })
    const oldFile = path.join(ContextReplay.directory("ses_example", legacy), "100-msg_legacy.json")
    const source = '{"version":1,"messages":[{"role":"user","content":"V1 history"}]}\n'
    await Bun.write(oldFile, source)
    await ContextReplay.record(
      { sessionID: "ses_example", messageID: "msg_current", time: 200 },
      { version: 2, messages: ["V2 history"] },
      current,
    )
    const listed = await cli("ses_example")
    expect(listed.code).toBe(0)
    expect(listed.stdout).toMatch(/1  100-msg_legacy.json\n2  200-msg_current-/)
    const old = await cli("ses_example", "1")
    expect(old.code).toBe(0)
    expect(JSON.parse(old.stdout)).toEqual(JSON.parse(source))
    const loaded = await cli("ses_example", "2")
    expect(loaded.code).toBe(0)
    expect(JSON.parse(loaded.stdout)).toEqual({ version: 2, messages: ["V2 history"] })
    const invalid = await cli("ses_example", "3")
    expect(invalid.code).toBe(1)
    expect(invalid.stderr).toContain("Turn 3 not found (2 recorded)")
    const traversal = await cli("../outside")
    expect(traversal.code).toBe(1)
    expect(traversal.stderr).toContain("Invalid context replay identifier")
    expect(await Bun.file(oldFile).text()).toBe(source)
    expect(await Bun.file(path.join(home, "state", "opencode", "service-local.json")).exists()).toBe(false)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})
