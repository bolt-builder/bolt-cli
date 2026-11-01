import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { initRepo } from "../../core/test/fixture/git"
import { isolatedEnv } from "./fixture/environment"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("port previews, cherry-picks isolated branches, preserves dirty checkout and cleans conflicts", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-port-command-"))
  const project = path.join(home, "project")
  await fs.mkdir(project)
  await initRepo(project)
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(["git", ...args], {
      cwd: project,
      env: isolatedEnv(home),
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(result.exitCode, result.stderr.toString()).toBe(0)
    return result.stdout.toString().trim()
  }
  await Bun.write(path.join(project, "source"), "base\n")
  git("add", ".")
  git("commit", "-m", "base source")
  git("branch", "stable")
  const branch = git("symbolic-ref", "--short", "HEAD")
  git("checkout", "-b", "conflicting")
  await Bun.write(path.join(project, "source"), "other\n")
  git("commit", "-am", "conflicting change")
  git("checkout", branch)
  await Bun.write(path.join(project, "source"), "fix\n")
  git("commit", "-am", "fix")
  const sha = git("rev-parse", "HEAD")
  await Bun.write(path.join(project, "source"), "user edit\n")
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, "port", sha, ...args],
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
    expect(git("symbolic-ref", "--short", "HEAD")).toBe(branch)
    expect(git("rev-parse", "HEAD")).toBe(sha)
    expect(await Bun.file(path.join(project, "source")).text()).toBe("user edit\n")
    expect(git("worktree", "list", "--porcelain").match(/^worktree /gm)).toHaveLength(1)
    return { stdout, stderr, code }
  }
  try {
    const preview = await cli("--to", "stable")
    expect(preview.code, preview.stderr).toBe(0)
    expect(preview.stdout).toContain("Dry run")
    expect(git("branch", "--list", `port-${sha.slice(0, 7)}-stable`)).toBe("")
    const applied = await cli("--to", "stable", "--apply")
    expect(applied.code, applied.stderr).toBe(0)
    const port = `port-${sha.slice(0, 7)}-stable`
    expect(git("show", `${port}:source`)).toBe("fix")
    expect(git("log", "-1", "--format=%b", port)).toContain(`cherry picked from commit ${sha}`)
    const collision = await cli("--to", "stable", "--apply")
    expect(collision.code).toBe(1)
    expect(collision.stderr).toContain("already exists")
    const conflict = await cli("--to", "conflicting", "--apply")
    expect(conflict.code).toBe(1)
    expect(conflict.stderr).toContain("cherry-pick conflicts in source")
    expect(git("branch", "--list", `port-${sha.slice(0, 7)}-conflicting`)).toBe("")
    const present = await cli("--to", port)
    expect(present.code, present.stderr).toBe(0)
    expect(present.stdout).toContain("already has an equivalent change")
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})

test("port handles a root commit without a parent", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-port-root-"))
  const project = path.join(home, "project")
  await fs.mkdir(project)
  await initRepo(project)
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(["git", ...args], {
      cwd: project,
      env: isolatedEnv(home),
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(result.exitCode, result.stderr.toString()).toBe(0)
    return result.stdout.toString().trim()
  }
  try {
    git("symbolic-ref", "HEAD", "refs/heads/root-fixture")
    await Bun.write(path.join(project, "root.txt"), "root change\n")
    git("add", ".")
    git("commit", "-m", "root change")
    const sha = git("rev-parse", "HEAD")
    git("branch", "original")
    git("checkout", "--orphan", "target")
    git("rm", "-rf", ".")
    await Bun.write(path.join(project, "other.txt"), "target\n")
    git("add", ".")
    git("commit", "-m", "target root")
    const run = async (target: string, apply: boolean) => {
      const child = Bun.spawn(
        [
          process.execPath,
          "run",
          "--jsx-import-source=@opentui/solid",
          entry,
          "port",
          sha,
          "--to",
          target,
          ...(apply ? ["--apply"] : []),
        ],
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
      expect(code, stderr).toBe(0)
      return stdout
    }
    expect(await run("original", false)).toContain("already has an equivalent change")
    expect(await run("target", false)).toContain("needs the fix")
    expect(await run("target", true)).toContain("All ports complete")
    expect(git("show", `port-${sha.slice(0, 7)}-target:root.txt`)).toBe("root change")
    expect(git("status", "--porcelain")).toBe("")
    expect(git("symbolic-ref", "--short", "HEAD")).toBe("target")
    expect(git("worktree", "list", "--porcelain").match(/^worktree /gm)).toHaveLength(1)
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
}, 30_000)
