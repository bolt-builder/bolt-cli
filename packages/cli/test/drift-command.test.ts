import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

test("drift checks working, staged and branch deletions against docs and surviving code", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-drift-"))
  const root = path.join(home, "project")
  await fs.mkdir(root)
  const run = async (args: string[]) => {
    const child = Bun.spawn(args, {
      cwd: root,
      env: isolatedEnv(home),
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  const git = async (...args: string[]) => expect((await run(["git", ...args])).code).toBe(0)
  const cli = (...args: string[]) =>
    run([
      process.execPath,
      "run",
      "--jsx-import-source=@opentui/solid",
      path.resolve(import.meta.dir, "../src/index.ts"),
      "drift",
      ...args,
    ])
  try {
    await git("init", "-q", "-b", "main")
    await Bun.write(path.join(root, "api.ts"), "export function oldSymbol() {}\nexport function survivor() {}\n")
    await Bun.write(path.join(root, "README.md"), "Use oldSymbol and survivor.\n")
    await Bun.write(path.join(root, ".gitignore"), "ignored.ts\n")
    await Bun.write(path.join(root, "ignored.ts"), "oldSymbol()\n")
    await git("add", "api.ts", "README.md", ".gitignore")
    await git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture")
    expect((await cli()).stdout).toContain("Nothing to check")
    await Bun.write(path.join(root, "api.ts"), "export function replacement() {}\n")
    await Bun.write(path.join(root, "caller.ts"), "survivor()\n")
    const stale = await cli()
    expect(stale.code).toBe(1)
    expect(stale.stdout).toContain("1 removed symbol")
    expect(stale.stdout).toContain("oldSymbol (removed from api.ts)")
    expect(stale.stdout).not.toContain("survivor (removed")
    expect(stale.stdout).toContain("README.md:1")
    expect((await cli("--staged")).stdout).toContain("Nothing to check")
    await git("add", "api.ts")
    expect(await cli("--staged")).toMatchObject({ code: 1 })
    await git("checkout", "-qb", "feature")
    await git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "remove legacy")
    for (const flags of [["--branch=main"], ["--branch", "main"], ["--branch"]])
      expect((await cli(...flags)).stdout).toContain("oldSymbol (removed")
    expect((await cli("--staged", "--branch=main")).code).toBe(1)
    expect((await cli("--branch=missing")).stderr).toContain("Could not find a merge base")
    await Bun.write(path.join(root, "README.md"), "Use replacement.\n")
    expect((await cli("--branch=main")).code).toBe(0)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})
