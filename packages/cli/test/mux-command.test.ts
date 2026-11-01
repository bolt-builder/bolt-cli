import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { isolatedEnv } from "./fixture/environment"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
// tmux is a POSIX dependency. The original command reports its absence on Windows.
test.skipIf(!Bun.which("tmux"))("mux creates isolated tmux panes, applies layouts and rejects collisions", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-mux-command-"))
  const bin = path.join(home, "bin")
  await fs.mkdir(bin)
  await Bun.write(path.join(bin, "bolt"), "#!/bin/sh\nexec sleep 3600\n")
  await fs.chmod(path.join(bin, "bolt"), 0o755)
  const env = isolatedEnv(home, {
    PATH: [bin, process.env.PATH].join(path.delimiter),
    TMUX: undefined,
    TMUX_TMPDIR: home,
  })
  const tmux = (...args: string[]) => Bun.spawnSync(["tmux", ...args], { env, stdout: "pipe", stderr: "pipe" })
  const cli = async (...args: string[]) => {
    const child = Bun.spawn([process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, "mux", ...args], {
      cwd: home,
      env,
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
    const created = await cli("--name", "restored", "--count", "2", "--layout", "even-vertical")
    expect(created.code, created.stderr).toBe(0)
    expect(created.stdout).toContain("Started tmux session 'restored'")
    const panes = tmux("list-panes", "-t", "restored", "-F", "#{pane_current_path}")
    expect(panes.exitCode, panes.stderr.toString()).toBe(0)
    expect(panes.stdout.toString().trim().split(/\r?\n/)).toEqual([home, home])
    const collision = await cli("--name", "restored")
    expect(collision.code).toBe(1)
    expect(collision.stderr).toContain("already exists")
    const invalid = await cli("--count", "17")
    expect(invalid.code).toBe(1)
    expect(invalid.stderr).toContain("between 1 and 16")
    const missing = await cli(path.join(home, "missing"), "--name", "missing")
    expect(missing.code).toBe(1)
    expect(tmux("has-session", "-t", "missing").exitCode).not.toBe(0)
  } finally {
    tmux("kill-server")
    await fs.rm(home, { recursive: true, force: true })
  }
})
