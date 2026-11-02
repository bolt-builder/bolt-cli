import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { initRepo } from "../../core/test/fixture/git"
import { isolatedEnv } from "./fixture/environment"
import { workflowServer } from "./fixture/workflow-server"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("rebase previews, validates, quotes rewords literally and applies only to a clean unchanged branch", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-rebase-command-"))
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
  await git("branch", "base")
  await Bun.write(path.join(project, "one.txt"), "one\n")
  await git("add", ".")
  await git("commit", "-m", "one")
  const one = (await git("rev-parse", "HEAD")).stdout.trim()
  await Bun.write(path.join(project, "two.txt"), "two\n")
  await git("add", ".")
  await git("commit", "-m", "two")
  const two = (await git("rev-parse", "HEAD")).stdout.trim()
  let mode = "clean"
  const subject = "literal $HOME `pwd` $(touch injected) 'quoted'"
  const fixture = workflowServer(async ({ agent, text }) => {
    expect(agent).toBe("plan")
    expect(text).toContain(one)
    expect(text).toContain(two)
    if (mode === "moved") await git("commit", "--allow-empty", "-m", "concurrent")
    return `\`\`\`\nreword ${one} "${subject}" :: clearer message\n${mode === "invalid" ? "pick" : "fixup"} ${mode === "invalid" ? "f".repeat(40) : two} :: fold related change\n\`\`\``
  })
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "rebase",
        "--onto",
        "base",
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
    const preview = await cli("--model", "fixture/model#fast")
    expect(preview.code, preview.stderr).toBe(0)
    expect(preview.stdout).toContain("Dry run")
    expect((await git("rev-parse", "HEAD")).stdout.trim()).toBe(two)
    mode = "invalid"
    const invalid = await cli("--apply")
    expect(invalid.code).toBe(1)
    expect(invalid.stderr).toContain("invalid plan")
    mode = "clean"
    await Bun.write(path.join(project, "untracked"), "preserve")
    const dirty = await cli("--apply")
    expect(dirty.code).toBe(1)
    expect(dirty.stderr).toContain("uncommitted changes")
    expect(await Bun.file(path.join(project, "untracked")).text()).toBe("preserve")
    await fs.rm(path.join(project, "untracked"))
    mode = "moved"
    const moved = await cli("--apply")
    expect(moved.code).toBe(1)
    expect(moved.stderr).toContain("HEAD changed")
    expect((await git("log", "-1", "--format=%s")).stdout.trim()).toBe("concurrent")
    await git("reset", "--hard", two)
    mode = "clean"
    const applied = await cli("--apply")
    expect(applied.code, applied.stderr).toBe(0)
    expect(applied.stdout).toContain("Rebase complete")
    expect((await git("rev-list", "--count", "base..HEAD")).stdout.trim()).toBe("1")
    expect((await git("log", "-1", "--format=%s")).stdout.trim()).toBe(subject)
    expect(await Bun.file(path.join(project, "injected")).exists()).toBe(false)
    expect(await Bun.file(path.join(project, "one.txt")).text()).toBe("one\n")
    expect(await Bun.file(path.join(project, "two.txt")).text()).toBe("two\n")
    expect((await git("status", "--porcelain")).stdout).toBe("")
    expect(fixture.removed).toHaveLength(5)
  } finally {
    await fixture.server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 30_000)
