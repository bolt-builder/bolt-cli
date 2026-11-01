import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { initRepo } from "../../core/test/fixture/git"
import { isolatedEnv } from "./fixture/environment"
import { workflowServer } from "./fixture/workflow-server"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("resolve previews and stages real conflicts, preserving changed files and rejecting malformed resolutions", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-resolve-command-"))
  const project = path.join(home, "project")
  const nested = path.join(project, "src")
  const name = 'two "sides".ts'
  const source = path.join(nested, name)
  await fs.mkdir(nested, { recursive: true })
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
  await Bun.write(source, "base\n")
  await git("add", ".")
  await git("commit", "-m", "base")
  const main = (await git("branch", "--show-current")).stdout.trim()
  await git("checkout", "-b", "other")
  await Bun.write(source, "theirs\n")
  await git("commit", "-am", "theirs")
  await git("checkout", main)
  await Bun.write(source, "ours\n")
  await git("commit", "-am", "ours")
  expect((await git("merge", "other")).code).toBe(1)
  const original = await Bun.file(source).text()
  let mode = "clean"
  const fixture = workflowServer(async ({ agent, text }) => {
    expect(agent).toBe("plan")
    expect(text).toContain('File: src/two "sides".ts')
    expect(text).toContain("Ours: HEAD")
    if (mode === "stale") await Bun.write(source, "user changed the file\n")
    return mode === "invalid"
      ? "```\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> other\n```"
      : "Both intents preserved.\n```ts\nours\ntheirs\n```"
  })
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "resolve",
        ...args,
        "--server",
        fixture.server.url.toString(),
      ],
      {
        cwd: nested,
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
    const preview = await cli(name, "--model", "fixture/model#fast")
    expect(preview.code, preview.stderr).toBe(0)
    expect(preview.stdout).toContain("Proposed resolution")
    expect(await Bun.file(source).text()).toBe(original)
    expect((await git("ls-files", "-u")).stdout).not.toBe("")
    expect([...fixture.sessions.values()][0]!.permissions).toEqual(
      expect.arrayContaining([
        { action: "edit", resource: "*", effect: "deny" },
        { action: "shell", resource: "*", effect: "deny" },
      ]),
    )
    mode = "invalid"
    const invalid = await cli("--apply")
    expect(invalid.code).toBe(1)
    expect(invalid.stderr).toContain("clean resolution")
    expect(await Bun.file(source).text()).toBe(original)
    mode = "stale"
    const stale = await cli("--apply")
    expect(stale.code).toBe(1)
    expect(stale.stderr).toContain("changed while resolving")
    expect(await Bun.file(source).text()).toBe("user changed the file\n")
    expect((await git("ls-files", "-u")).stdout).not.toBe("")
    await Bun.write(source, "x".repeat(60_001))
    const large = await cli("--apply")
    expect(large.code).toBe(1)
    expect(large.stderr).toContain("too large")
    expect(fixture.sessions.size).toBe(3)
    await Bun.write(source, original)
    mode = "clean"
    const applied = await cli("--apply")
    expect(applied.code, applied.stderr).toBe(0)
    expect(applied.stdout).toContain("Resolved and staged")
    expect(await Bun.file(source).text()).toBe("ours\ntheirs\n")
    expect((await git("ls-files", "-u")).stdout).toBe("")
    const clean = await cli()
    expect(clean.code, clean.stderr).toBe(0)
    expect(clean.stdout).toContain("No merge conflicts")
    const unknown = await cli(name)
    expect(unknown.code).toBe(1)
    expect(unknown.stderr).toContain("Not unmerged")
    expect(fixture.removed).toHaveLength(4)
  } finally {
    await fixture.server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 30_000)
