import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { initRepo } from "../../core/test/fixture/git"
import { isolatedEnv } from "./fixture/environment"
import { workflowServer } from "./fixture/workflow-server"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("split preserves previews and concurrent edits, then creates planned commits with renames and untracked files", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-split-command-"))
  const project = path.join(home, "project")
  await fs.mkdir(project)
  await initRepo(project)
  const git = async (...args: string[]) => {
    const child = Bun.spawn(["git", "-c", "core.autocrlf=false", ...args], {
      cwd: project,
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
  await Bun.write(path.join(project, "old name.ts"), "original\n")
  await git("add", ".")
  await git("commit", "-m", "base")
  const head = (await git("rev-parse", "HEAD")).stdout.trim()
  await git("mv", "old name.ts", "new name.ts")
  await Bun.write(path.join(project, "notes.txt"), "new\n")
  let mode = "clean"
  const fixture = workflowServer(async ({ agent, text }) => {
    expect(agent).toBe("plan")
    expect(text).toContain("new name.ts")
    expect(text).toContain("notes.txt")
    if (mode === "stale") await Bun.write(path.join(project, "notes.txt"), "concurrent change\n")
    return `\`\`\`\ncommit: refactor: rename\n- new name.ts\n${mode === "missing" ? "" : "commit: docs: notes\n- notes.txt\n"}\`\`\``
  })
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "split",
        ...args,
        "--server",
        fixture.server.url.toString(),
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
    return { stdout, stderr, code }
  }
  try {
    const index = (await git("ls-files", "--stage")).stdout
    const preview = await cli("--model", "fixture/model#fast")
    expect(preview.code, preview.stderr).toBe(0)
    expect(preview.stdout).toContain("Dry run")
    expect((await git("rev-parse", "HEAD")).stdout.trim()).toBe(head)
    expect((await git("ls-files", "--stage")).stdout).toBe(index)
    mode = "missing"
    const missing = await cli("--apply")
    expect(missing.code).toBe(1)
    expect(missing.stderr).toContain("missing files")
    expect((await git("ls-files", "--stage")).stdout).toBe(index)
    mode = "stale"
    const stale = await cli("--apply")
    expect(stale.code).toBe(1)
    expect(stale.stderr).toContain("changed while planning")
    expect(await Bun.file(path.join(project, "notes.txt")).text()).toBe("concurrent change\n")
    expect((await git("ls-files", "--stage")).stdout).toBe(index)
    mode = "clean"
    const applied = await cli("--apply")
    expect(applied.code, applied.stderr).toBe(0)
    expect(applied.stdout).toContain("All commits created")
    expect((await git("log", "--format=%s", `${head}..HEAD`)).stdout.trim().split("\n")).toEqual([
      "docs: notes",
      "refactor: rename",
    ])
    expect((await git("diff", "--name-status", `${head}..HEAD~1`)).stdout.trim()).toBe("R100\told name.ts\tnew name.ts")
    expect((await git("status", "--porcelain")).stdout).toBe("")
    expect(await Bun.file(path.join(project, "notes.txt")).text()).toBe("concurrent change\n")
    expect(fixture.removed).toHaveLength(4)
    expect((await cli()).stdout).toContain("worktree is clean")
  } finally {
    await fixture.server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 30_000)

test("split previews and creates initial commits in an unborn repository", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-split-unborn-"))
  const project = path.join(home, "project")
  await fs.mkdir(project)
  await initRepo(project)
  const git = (...args: string[]) =>
    Bun.spawnSync(["git", ...args], { cwd: project, env: isolatedEnv(home), stdout: "pipe", stderr: "pipe" })
  const fixture = workflowServer(async ({ text }) => {
    expect(text).toContain("staged.txt")
    expect(text).toContain("new.txt")
    return "```\ncommit: feat: first\n- staged.txt\ncommit: feat: second\n- new.txt\n```"
  })
  try {
    expect(git("symbolic-ref", "HEAD", "refs/heads/unborn").exitCode).toBe(0)
    await Bun.write(path.join(project, "staged.txt"), "staged\n")
    expect(git("add", "staged.txt").exitCode).toBe(0)
    await Bun.write(path.join(project, "new.txt"), "new\n")
    const index = git("ls-files", "--stage").stdout.toString()
    const run = async (apply: boolean) => {
      const child = Bun.spawn(
        [
          process.execPath,
          "run",
          "--jsx-import-source=@opentui/solid",
          entry,
          "split",
          ...(apply ? ["--apply"] : []),
          "--server",
          fixture.server.url.toString(),
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
    expect(await run(false)).toContain("Dry run")
    expect(git("rev-parse", "--verify", "HEAD").exitCode).not.toBe(0)
    expect(git("ls-files", "--stage").stdout.toString()).toBe(index)
    expect(await run(true)).toContain("All commits created")
    expect(git("log", "--format=%s").stdout.toString().trim().split("\n")).toEqual(["feat: second", "feat: first"])
    expect(git("status", "--porcelain").stdout.toString()).toBe("")
  } finally {
    await fixture.server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 30_000)
