import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"
import type { Job } from "../src/commands/handlers/jobs"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
const module = path.resolve(import.meta.dir, "../src/commands/handlers/jobs.ts")

test("detached jobs retain logs and argv, kill descendants and cap health-driven restarts", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-jobs-"))
  const cwd = path.join(home, "project")
  await fs.mkdir(cwd)
  const env = isolatedEnv(home)
  const created: Job[] = []
  const run = async (args: string[]) => {
    const child = Bun.spawn(args, { cwd, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  const cli = (...args: string[]) =>
    run([process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, ...args])
  const spawnJob = async (argv: string[]) => {
    const result = await run([
      process.execPath,
      "--jsx-import-source=@opentui/solid",
      "-e",
      `process.argv[1] = ${JSON.stringify(entry)}; const { spawnJob } = await import(${JSON.stringify(module)}); console.log(JSON.stringify(await spawnJob(${JSON.stringify(argv)}, process.cwd())))`,
    ])
    expect(result.code, result.stderr).toBe(0)
    const job: Job = JSON.parse(result.stdout)
    created.push(job)
    return job
  }
  const waitFor = async (condition: () => Promise<boolean>) => {
    const deadline = Date.now() + 8000
    while (Date.now() < deadline) {
      if (await condition()) return
      await Bun.sleep(30)
    }
    throw new Error("Timed out waiting for detached fixture")
  }
  const alive = (pid: number) => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  try {
    expect((await cli("jobs", "list")).stdout).toContain("No background jobs")
    // The explicit server fails locally; no provider or real service can be contacted.
    const server = Bun.serve({ port: 0, fetch: () => new Response("fixture rejected request", { status: 503 }) })
    try {
      const background = await cli("run", "--background", "--server", server.url.toString(), "--", "--bg")
      expect(background.code).toBe(0)
      expect(background.stdout).toContain("Started background job")
      const dir = path.join(home, "state/opencode/jobs")
      const name = (await fs.readdir(dir)).find((name) => name.endsWith(".json"))!
      const job: Job = await Bun.file(path.join(dir, name)).json()
      created.push(job)
      expect(job.argv).toContain("--bg")
      expect(job.argv).not.toContain("--background")
      expect(job.argv?.slice(-2)).toEqual(["--", "--bg"])
      await waitFor(async () => (await Bun.file(job.log).text()).length > 0)
      expect((await cli("jobs", "tail", job.id)).stdout.length).toBeGreaterThan(0)
      expect((await cli("jobs", "list")).stdout).toContain(job.id)
    } finally {
      server.stop(true)
    }
    const running = await spawnJob(["flaky", "echo $$ > child.pid; exec sleep 30", "--runs=1"])
    await waitFor(async () => Bun.file(path.join(cwd, "child.pid")).exists())
    const descendant = Number(await Bun.file(path.join(cwd, "child.pid")).text())
    expect(alive(descendant)).toBe(true)
    expect((await cli("jobs", "kill", running.id)).code).toBe(0)
    await waitFor(async () => !alive(descendant))
    const unhealthy = await spawnJob(["index", "--watch"])
    const supervised = await cli(
      "jobs",
      "supervise",
      unhealthy.id,
      "--health=exit 1",
      "--interval=0.2",
      "--retries=1",
      "--limit=1",
    )
    expect(supervised.code).toBe(1)
    expect(supervised.stdout).toContain("Restart 1/1")
    expect(supervised.stderr).toContain("restart cap (1)")
    const restarted: Job = await Bun.file(path.join(home, "state/opencode/jobs", `${unhealthy.id}.json`)).json()
    created.push(restarted)
    expect(restarted.id).toBe(unhealthy.id)
    expect(restarted.pid).not.toBe(unhealthy.pid)
    expect(restarted.restarts).toHaveLength(1)
    expect(restarted.restarts?.[0]?.reason).toContain("health check failed")
    expect(restarted.argv).toEqual(["index", "--watch"])
    expect((await cli("jobs", "kill", restarted.id)).code).toBe(0)
    const dead = await spawnJob(["index", "--watch"])
    expect((await cli("jobs", "kill", dead.id)).code).toBe(0)
    await waitFor(async () => !alive(dead.pid))
    let probes = 0
    const health = Bun.serve({
      port: 0,
      fetch: () => {
        probes++
        return new Response("healthy")
      },
    })
    const monitor = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "jobs",
        "supervise",
        dead.id,
        "--health",
        health.url.toString(),
        "--interval=0.2",
        "--limit=1",
      ],
      { cwd, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    )
    try {
      await waitFor(async () => probes >= 2)
      const recovered: Job = await Bun.file(path.join(home, "state/opencode/jobs", `${dead.id}.json`)).json()
      created.push(recovered)
      expect(recovered.restarts).toHaveLength(1)
      expect(recovered.restarts?.[0]?.reason).toBe("process died")
      expect(recovered.pid).not.toBe(dead.pid)
      expect(alive(recovered.pid)).toBe(true)
    } finally {
      monitor.kill("SIGINT")
      await monitor.exited
      health.stop(true)
    }
  } finally {
    for (const job of created) {
      try {
        process.kill(-job.pid, "SIGKILL")
      } catch {}
    }
    await fs.rm(home, { recursive: true, force: true })
  }
}, 60000)
