import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { initRepo } from "../../core/test/fixture/git"
import { isolatedEnv } from "./fixture/environment"
import { workflowServer } from "./fixture/workflow-server"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("stack previews an ordered partition, preserves checkout, rejects collisions and pushes only requested branches", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-stack-command-"))
  const project = path.join(home, "project")
  const origin = path.join(home, "origin.git")
  await fs.mkdir(project)
  await initRepo(project)
  const git = async (...args: string[]) => {
    const child = Bun.spawn(["git", ...args], { cwd: project, stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  await git("init", "--bare", origin)
  await git("remote", "add", "origin", origin)
  await git("branch", "base")
  const shas: string[] = []
  for (const name of ["one", "two", "three"]) {
    await Bun.write(path.join(project, name), name)
    await git("add", ".")
    await git("commit", "-m", name)
    shas.push((await git("rev-parse", "HEAD")).stdout.trim())
  }
  const original = (await git("branch", "--show-current")).stdout.trim()
  let mode = "clean"
  const fixture = workflowServer(async ({ agent }) => {
    expect(agent).toBe("plan")
    return `\`\`\`\nbranch: stack-first :: feat: one\n- ${shas[0]}\nbranch: stack-second :: feat: two and three\n- ${shas[mode === "reordered" ? 2 : 1]}\n- ${shas[mode === "reordered" ? 1 : 2]}\n\`\`\``
  })
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "stack",
        "--base",
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
    await Bun.write(path.join(project, "untracked"), "preserve")
    const preview = await cli()
    expect(preview.code, preview.stderr).toBe(0)
    expect(preview.stdout).toContain("Dry run")
    expect((await git("show-ref", "--verify", "refs/heads/stack-first")).code).not.toBe(0)
    mode = "reordered"
    const invalid = await cli("--apply")
    expect(invalid.code).toBe(1)
    expect(invalid.stderr).toContain("oldest first")
    mode = "clean"
    await git("branch", "stack-second", "base")
    const collision = await cli("--apply")
    expect(collision.code).toBe(1)
    expect(collision.stderr).toContain("already exists")
    expect((await git("show-ref", "--verify", "refs/heads/stack-first")).code).not.toBe(0)
    await git("branch", "-d", "stack-second")
    const applied = await cli("--push", "--model", "fixture/model#fast")
    expect(applied.code, applied.stderr).toBe(0)
    expect(applied.stdout).toContain("Pushed stack-first")
    expect(applied.stdout).toContain("Pushed stack-second")
    expect(applied.stdout).toContain("--base 'stack-first'")
    expect((await git("rev-parse", "stack-first")).stdout.trim()).toBe(shas[0]!)
    expect((await git("rev-parse", "stack-second")).stdout.trim()).toBe(shas[2]!)
    expect((await git("--git-dir", origin, "rev-parse", "stack-first")).stdout.trim()).toBe(shas[0]!)
    expect((await git("--git-dir", origin, "rev-parse", "stack-second")).stdout.trim()).toBe(shas[2]!)
    expect((await git("branch", "--show-current")).stdout.trim()).toBe(original)
    expect((await git("rev-parse", "HEAD")).stdout.trim()).toBe(shas[2]!)
    expect(await Bun.file(path.join(project, "untracked")).text()).toBe("preserve")
    expect(fixture.removed).toHaveLength(4)
  } finally {
    await fixture.server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 30_000)
