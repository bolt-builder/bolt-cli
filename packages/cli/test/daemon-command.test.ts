import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"
import { ServiceConfig } from "../src/services/service-config"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("daemon shares V2 service discovery and stops its isolated server without exposing credentials", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-daemon-command-"))
  const env = isolatedEnv(home)
  const spawn = (...args: string[]) =>
    Bun.spawn([process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, "daemon", ...args], {
      cwd: home,
      env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    })
  const cli = async (...args: string[]) => {
    const child = spawn(...args)
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  let daemon: ReturnType<typeof spawn> | undefined
  let output: Promise<string> | undefined
  let errors: Promise<string> | undefined
  try {
    const absent = await cli("--status")
    expect(absent.code).toBe(1)
    expect(absent.stderr).toContain("no daemon is running")
    const invalid = await cli("--status", "--stop")
    expect(invalid.code).toBe(1)
    expect(invalid.stderr).toContain("cannot be combined")
    daemon = spawn("--hostname", "127.0.0.1", "--port", "0")
    output = new Response(daemon.stdout).text()
    errors = new Response(daemon.stderr).text()
    const registration = path.join(home, "state", "opencode", ServiceConfig.filename())
    const deadline = Date.now() + 30_000
    let info: { url: string; pid: number; password?: string } | undefined
    while (Date.now() < deadline) {
      const current = await Bun.file(registration)
        .json()
        .catch(() => undefined)
      if (current?.password && current.pid === daemon.pid) {
        const response = await fetch(new URL("/api/info", current.url), {
          headers: { authorization: `Basic ${Buffer.from(`opencode:${current.password}`).toString("base64")}` },
        }).catch(() => undefined)
        if (response?.ok) {
          info = current
          break
        }
      }
      if (daemon.exitCode !== null) throw new Error(`Daemon stopped before readiness: ${await errors}`)
      await Bun.sleep(50)
    }
    expect(info, "daemon reached authenticated readiness").toBeDefined()
    const status = await cli("--status")
    expect(status.code, status.stderr).toBe(0)
    expect(status.stdout).toContain(`daemon running at ${info!.url}`)
    const duplicate = await cli()
    expect(duplicate.code).toBe(1)
    expect(duplicate.stderr).toContain("already running")
    const stop = await cli("--stop")
    expect(stop.code, stop.stderr).toBe(0)
    expect(stop.stdout).toContain("stopped daemon")
    await daemon.exited
    const after = await cli("--status")
    expect(after.code).toBe(1)
    expect(after.stderr).toContain("no daemon is running")
    expect(await Bun.file(registration).exists()).toBe(false)
    const text = status.stdout + duplicate.stderr + stop.stdout + (await output) + (await errors)
    expect(text).not.toContain(info!.password!)
    expect((await fs.stat(path.join(home, "config", ServiceConfig.filename()))).mode & 0o777).toBe(
      process.platform === "win32" ? 0o666 : 0o600,
    )
  } finally {
    if (daemon?.exitCode === null) daemon.kill()
    await daemon?.exited
    await output
    await errors
    await fs.rm(home, { recursive: true, force: true })
  }
}, 45_000)
