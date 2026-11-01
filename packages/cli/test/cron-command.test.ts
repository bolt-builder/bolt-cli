import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

test("cron persists and removes schedules, dispatches a due job and stops after interruption", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-cron-"))
  const env = isolatedEnv(root)
  const entry = path.resolve(import.meta.dir, "../src/index.ts")
  const cli = async (...args: string[]) => {
    const proc = Bun.spawn([process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, "cron", ...args], {
      cwd: root,
      env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { stdout, stderr, code }
  }
  const dir = path.join(root, "state/opencode/cron")
  const jobDir = path.join(root, "state/opencode/jobs")
  try {
    expect((await cli("list")).stdout).toContain("No cron entries")
    expect((await cli("add", "invalid", "fixture")).code).toBe(1)
    expect((await cli("add", "* * * * *", "fixture prompt")).code).toBe(0)
    const files = await fs.readdir(dir)
    expect(files).toHaveLength(1)
    const file = path.join(dir, files[0])
    const stored = await Bun.file(file).json()
    expect(stored).toMatchObject({ schedule: "* * * * *", prompt: "fixture prompt", cwd: root })
    expect((await cli("list")).stdout).toContain("fixture prompt")
    // Dispatch the CLI help action so this scheduler test cannot contact an agent/provider.
    await Bun.write(file, JSON.stringify({ ...stored, prompt: "--help" }))
    const preload = path.join(root, "minute-timer.js")
    // Position this child's clock near a minute boundary; matching still uses a real Date.
    await Bun.write(
      preload,
      "const clock = Date.now; Date.now = () => { const stamp = clock(); return stamp - stamp % 60000 + 59900 }\n",
    )
    const scheduler = Bun.spawn(
      [process.execPath, "--preload", preload, "--jsx-import-source=@opentui/solid", entry, "cron", "start"],
      { cwd: root, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    )
    try {
      const deadline = Date.now() + 8000
      let dispatched = false
      while (Date.now() < deadline) {
        const jobs = await fs.readdir(jobDir).catch(() => [])
        if (jobs.some((name) => name.endsWith(".json"))) {
          dispatched = true
          break
        }
        await Bun.sleep(5)
      }
      expect(dispatched).toBe(true)
    } finally {
      scheduler.kill("SIGINT")
      await scheduler.exited
    }
    const jobFiles = (await fs.readdir(jobDir)).filter((name) => name.endsWith(".json"))
    const job = await Bun.file(path.join(jobDir, jobFiles[0])).json()
    expect(job.argv).toEqual(["run", "--help"])
    expect(job.cwd).toBe(root)
    const count = jobFiles.length
    await Bun.sleep(60)
    expect((await fs.readdir(jobDir)).filter((name) => name.endsWith(".json"))).toHaveLength(count)
    expect((await cli("rm", stored.id.slice(0, -1))).code).toBe(0)
    expect((await cli("list")).stdout).toContain("No cron entries")
  } finally {
    const jobs = (await fs.readdir(jobDir).catch(() => [])).filter((name) => name.endsWith(".json"))
    for (const name of jobs) {
      const job = await Bun.file(path.join(jobDir, name)).json()
      try {
        process.kill(-job.pid, "SIGKILL")
      } catch {}
    }
    await fs.rm(root, { recursive: true, force: true })
  }
})
