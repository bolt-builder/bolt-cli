import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { initRepo } from "../../core/test/fixture/git"
import { isolatedEnv } from "./fixture/environment"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("mutate verifies baseline, kills or reports survivors, detects runner and always restores bytes", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-mutate-command-"))
  const project = path.join(home, "project")
  await fs.mkdir(project)
  await initRepo(project)
  const original = Buffer.from("\ufeffmodule.exports = true\r\n")
  await fs.writeFile(path.join(project, "source.cjs"), original)
  await Bun.write(path.join(project, "check.cjs"), 'process.exitCode = require("./source.cjs") === true ? 0 : 1')
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, "mutate", "source.cjs", ...args],
      {
        cwd: project,
        env: isolatedEnv(home),
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect(await fs.readFile(path.join(project, "source.cjs"))).toEqual(original)
    return { stdout, stderr, code }
  }
  try {
    const killed = await cli("--command", `"${process.execPath}" check.cjs`)
    expect(killed.code, killed.stderr).toBe(0)
    expect(killed.stdout).toContain("1/1 killed (100%)")
    const survivor = await cli("--command", `"${process.execPath}" -e "process.exit(0)"`)
    expect(survivor.code, survivor.stderr).toBe(1)
    expect(survivor.stdout).toContain("SURVIVED")
    const baseline = await cli("--command", `"${process.execPath}" -e "process.exit(1)"`)
    expect(baseline.code).toBe(1)
    expect(baseline.stderr).toContain("fails before any mutation")
    await Bun.write(
      path.join(project, "package.json"),
      JSON.stringify({ scripts: { test: `"${process.execPath}" check.cjs` } }),
    )
    await Bun.write(path.join(project, "bun.lock"), "")
    const detected = await cli()
    expect(detected.code, detected.stderr).toBe(0)
    expect(detected.stdout).toContain('Baseline: running "bun run test"')
    await Bun.write(path.join(project, "check.cjs"), 'if(require("./source.cjs")!==true)setInterval(()=>{},1000)')
    const timeout = await cli("--command", `"${process.execPath}" check.cjs`, "--timeout", "3000")
    expect(timeout.code, timeout.stderr).toBe(0)
    expect(timeout.stdout).toContain("killed")
    const invalid = await cli("--limit", "0")
    expect(invalid.code).toBe(1)
    expect(invalid.stderr).toContain("positive integer")
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})
