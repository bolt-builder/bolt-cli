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
      new Response(child.stdout).text().then((text) => text.replaceAll("\r\n", "\n")),
      new Response(child.stderr).text().then((text) => text.replaceAll("\r\n", "\n")),
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

test("bench exits nonzero when temporary worktree cleanup fails", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-bench-cleanup-"))
  const root = path.join(home, "project")
  const bin = path.join(home, "bin")
  await fs.mkdir(root)
  await fs.mkdir(bin)
  const git = Bun.which("git")
  if (!git) throw new Error("git is required for the fixture")
  const raw = async (...args: string[]) => {
    const proc = Bun.spawn([git, ...args], { cwd: root, stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    expect({ code, stderr }).toMatchObject({ code: 0 })
    return stdout
  }
  try {
    await raw("init", "-q", "-b", "main")
    await Bun.write(path.join(root, "file"), "fixture\n")
    await raw("add", ".")
    await raw("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture")
    if (process.platform === "win32")
      await Bun.write(
        path.join(bin, "git.cmd"),
        `@echo off\r\necho %* | findstr /R /C:"worktree.*remove" >nul && exit /b 1\r\n"${git}" %*\r\nexit /b %errorlevel%\r\n`,
      )
    if (process.platform !== "win32")
      await Bun.write(
        path.join(bin, "git"),
        `#!/bin/sh\ncase " $* " in *" worktree remove "*) exit 1;; esac\nexec "${git}" "$@"\n`,
      )
    if (process.platform !== "win32") await fs.chmod(path.join(bin, "git"), 0o755)
    const proc = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        path.resolve(import.meta.dir, "../src/index.ts"),
        "bench",
        "exit 0",
        "--base=HEAD",
        "--runs=1",
        "--warmup=0",
        "--threshold=1000000",
      ],
      {
        cwd: root,
        env: isolatedEnv(home, { PATH: `${bin}${path.delimiter}${process.env.PATH}` }),
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
      },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    expect(stdout).toContain("Verdict: neutral")
    expect(code).toBe(1)
    expect(stderr).toContain("Failed to remove the temporary worktree")
    const list = await raw("worktree", "list", "--porcelain")
    for (const match of list.matchAll(/^worktree (.+)$/gm))
      if ((await fs.realpath(match[1].trim())) !== (await fs.realpath(root)))
        await raw("worktree", "remove", "--force", match[1].trim())
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})
