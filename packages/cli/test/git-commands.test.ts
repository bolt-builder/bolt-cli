import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

test("bench cleans temporary checkouts after success and command failure; submodules reports and repairs drift", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-git-commands-"))
  const root = path.join(home, "project")
  const library = path.join(home, "library")
  await fs.mkdir(root)
  await fs.mkdir(library)
  const run = async (args: string[], cwd = root) => {
    const child = Bun.spawn(args, {
      cwd,
      env: isolatedEnv(home, { GIT_ALLOW_PROTOCOL: "file" }),
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
  const git = async (args: string[], cwd = root) => {
    const result = await run(["git", ...args], cwd)
    expect({ code: result.code, stderr: result.stderr }).toMatchObject({ code: 0 })
    return result.stdout
  }
  const commit = (cwd = root) =>
    git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qam", "fixture"], cwd)
  const cli = (...args: string[]) =>
    run([
      process.execPath,
      "run",
      "--jsx-import-source=@opentui/solid",
      path.resolve(import.meta.dir, "../src/index.ts"),
      ...args,
    ])
  try {
    await git(["init", "-q", "-b", "main"])
    await Bun.write(path.join(root, "file.txt"), "fixture\n")
    await git(["add", "."])
    await commit()
    const initial = await git(["worktree", "list", "--porcelain"])
    const measured = await cli("bench", "exit 0", "--runs=1", "--warmup=0", "--threshold=1000000")
    expect(measured).toMatchObject({ code: 0, stderr: "" })
    expect(measured.stdout).toContain("Base: mean")
    expect(measured.stdout).toContain("Verdict: neutral")
    expect(await git(["worktree", "list", "--porcelain"])).toBe(initial)
    const failed = await cli("bench", "exit 7", "--base=HEAD", "--runs=1", "--warmup=0")
    expect(failed).toMatchObject({ code: 1, stderr: "The command failed on base (exit 7).\n" })
    expect(await git(["worktree", "list", "--porcelain"])).toBe(initial)
    expect((await cli("bench", "exit 0", "--threshold=-1")).code).toBe(1)
    expect((await cli("submodules")).stdout).toBe("This repository declares no submodules.\n")
    await git(["init", "-q", "-b", "main"], library)
    await Bun.write(path.join(library, "library.txt"), "first\n")
    await git(["add", "."], library)
    await commit(library)
    await git(["submodule", "add", "-q", library, "vendor/library"])
    await commit()
    expect((await cli("submodules")).stdout).toContain("All submodules are in sync.")
    await Bun.write(path.join(library, "library.txt"), "second\n")
    await commit(library)
    const checkout = path.join(root, "vendor/library")
    await git(["fetch", "-q"], checkout)
    await git(["checkout", "-q", "origin/main"], checkout)
    const drift = await cli("submodules")
    expect(drift.code).toBe(1)
    expect(drift.stdout).toContain("checkout differs from the recorded commit")
    const synced = await cli("submodules", "--sync")
    expect(synced).toMatchObject({ code: 0, stderr: "" })
    expect(synced.stdout).toContain("All submodules are now in sync.")
    expect((await git(["submodule", "status"])).startsWith(" ")).toBe(true)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})
