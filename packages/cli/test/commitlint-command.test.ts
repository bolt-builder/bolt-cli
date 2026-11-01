import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const entry = path.resolve(import.meta.dir, "../src/index.ts")

test("commitlint learns main history, flags branch commits and honors explicit ranges", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-commitlint-"))
  const run = async (command: string[]) => {
    const child = Bun.spawn(command, {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
      env: { ...process.env, XDG_STATE_HOME: path.join(cwd, "state") },
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  const git = async (...args: string[]) => {
    const result = await run(["git", ...args])
    expect(result.code).toBe(0)
    return result.stdout.trim()
  }
  const cli = (...args: string[]) =>
    run([process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, "commitlint", ...args])
  try {
    await git("init", "--quiet", "-b", "main")
    await git("config", "user.email", "fixture@example.invalid")
    await git("config", "user.name", "Fixture")
    for (let i = 0; i < 10; i++) await git("commit", "--allow-empty", "--quiet", "-m", `feat(cli): fixture ${i}`)
    expect((await cli()).stdout).toContain("Nothing to lint")
    await git("checkout", "--quiet", "-b", "feature")
    await git("commit", "--allow-empty", "--quiet", "-m", "Bad subject.")
    const bad = await cli()
    expect(bad.code).toBe(1)
    expect(bad.stdout).toContain("1 of 1 commit messages break")
    expect(bad.stdout).toContain("not in the repo's type(scope): summary style")
    await git("commit", "--allow-empty", "--quiet", "-m", "feat(cli): valid subject")
    const good = await cli("--range", "HEAD~1..HEAD")
    expect(good.code).toBe(0)
    expect(good.stdout).toContain("All 1 commit messages match")
    expect((await cli("--history", "9")).stderr).toContain("--history must be at least 10")
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})
