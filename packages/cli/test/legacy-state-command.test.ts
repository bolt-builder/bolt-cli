import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

const entry = path.resolve(import.meta.dir, "../src/index.ts")

test("V1 jobs and cron retain logs, follow supervisors, prefer V2 collisions, and do not resurrect removed schedules", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-legacy-state-"))
  const legacy = path.join(root, "state", "bolt")
  const current = path.join(root, "state", "opencode")
  const cli = async (...args: string[]) => {
    const child = Bun.spawn([process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, ...args], {
      cwd: root,
      env: isolatedEnv(root),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  try {
    const log = path.join(legacy, "jobs", "imported.log")
    await Bun.write(log, "V1 output preserved\n")
    const job = {
      id: "imported",
      pid: 2147483646,
      command: "run legacy",
      argv: ["run", "legacy"],
      cwd: root,
      started: 1,
      log,
    }
    const oldJob = path.join(legacy, "jobs", "imported.json")
    await Bun.write(oldJob, JSON.stringify(job))
    await Bun.write(
      path.join(legacy, "jobs", "collision.json"),
      JSON.stringify({ ...job, id: "collision", command: "old collision", started: 500 }),
    )
    await Bun.write(
      path.join(current, "jobs", "collision.json"),
      JSON.stringify({ ...job, id: "collision", command: "current collision", started: 1 }),
    )
    const invalid = path.join(legacy, "jobs", "zz-invalid.json")
    await Bun.write(invalid, "{malformed}")
    const rejected = await cli("jobs", "list")
    expect(rejected.code).toBe(1)
    expect(rejected.stderr).toContain("Invalid V1 jobs record")
    expect(await Bun.file(path.join(current, "jobs", "imported.json")).exists()).toBe(false)
    expect(await Bun.file(invalid).text()).toBe("{malformed}")
    await fs.rm(invalid)
    const list = await cli("jobs", "list")
    expect(list.code, list.stderr).toBe(0)
    expect(list.stdout).toContain("run legacy")
    expect(list.stdout).toContain("current collision")
    expect(list.stdout).not.toContain("old collision")
    expect((await cli("jobs", "tail", "imported")).stdout).toBe("V1 output preserved\n")
    await Bun.write(oldJob, JSON.stringify({ ...job, pid: 2147483645, started: 2 }))
    const updated = await cli("jobs", "list")
    expect(updated.code, updated.stderr).toBe(0)
    expect(updated.stdout).toContain("2147483645")
    expect((await Bun.file(oldJob).json()).pid).toBe(2147483645)
    const schedule = { id: "imported", schedule: "0 9 * * 1", prompt: "weekly fixture", cwd: root, created: 1 }
    const oldCron = path.join(legacy, "cron", "imported.json")
    const original = JSON.stringify(schedule)
    await Bun.write(oldCron, original)
    expect((await cli("cron", "list")).stdout).toContain("weekly fixture")
    expect((await cli("cron", "rm", "imported")).code).toBe(0)
    expect((await cli("cron", "list")).stdout).toContain("No cron entries")
    expect(await Bun.file(oldCron).text()).toBe(original)
    expect(await Bun.file(log).text()).toBe("V1 output preserved\n")
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
