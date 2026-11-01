import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const entry = path.resolve(import.meta.dir, "../src/index.ts")

test("blast analyzes working tree, index and branch changes without a server", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-blast-"))
  const git = async (...args: string[]) => {
    const child = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
    const stderr = await new Response(child.stderr).text()
    expect({ code: await child.exited, stderr }).toEqual({ code: 0, stderr: "" })
  }
  const cli = async (...args: string[]) => {
    const child = Bun.spawn([process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, "blast", ...args], {
      cwd,
      env: { ...process.env, XDG_STATE_HOME: path.join(cwd, "state") },
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
  try {
    await git("init", "-q", "-b", "main")
    await Bun.write(path.join(cwd, "README.md"), "original\n")
    await git("add", "README.md")
    await git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "initial")
    expect(await cli()).toEqual({ stdout: "No tracked changes to analyze.\n", stderr: "", code: 0 })
    await Bun.write(path.join(cwd, "README.md"), "original\nchanged\n")
    const working = await cli()
    expect(working.code).toBe(0)
    expect(working.stdout).toContain("Blast radius (working tree)")
    expect(working.stdout).toContain("1 file changed (+1/-0)")
    expect(working.stdout).toContain("docs: 1")
    expect((await cli("--staged")).stdout).toBe("No tracked changes to analyze.\n")
    await git("add", "README.md")
    expect((await cli("--staged")).stdout).toContain("Blast radius (staged)")
    await git("checkout", "-qb", "feature")
    await git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "change")
    expect((await cli("--branch", "main")).stdout).toContain("1 file changed (+1/-0)")
    expect((await cli("--staged", "--branch", "main")).code).not.toBe(0)
    expect((await cli("--branch", "missing")).code).not.toBe(0)
    await Bun.write(path.join(cwd, "shared.js"), "export const value = 1\n")
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        Bun.write(
          path.join(cwd, `consumer${i}.js`),
          i % 2 === 0 ? 'import { value } from "./shared.js"\n' : "import { value } from './shared.js'\n",
        ),
      ),
    )
    await git("add", "--all")
    await git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "dependents")
    await Bun.write(path.join(cwd, "shared.js"), "export const value = 2\n")
    expect((await cli()).stdout).toContain("risk: high")
    expect(await Bun.file(path.join(cwd, "state/opencode/service-local.json")).exists()).toBe(false)
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test("blast includes staged files in a repository with no initial commit", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-blast-unborn-"))
  try {
    expect((await Bun.$`git init -q ${cwd}`.quiet().nothrow()).exitCode).toBe(0)
    await Bun.write(path.join(cwd, "new.ts"), "export const value = 1\n")
    expect((await Bun.$`git add new.ts`.cwd(cwd).quiet().nothrow()).exitCode).toBe(0)
    const child = Bun.spawn([process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, "blast"], {
      cwd,
      env: { ...process.env, XDG_STATE_HOME: path.join(cwd, "state") },
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    })
    const [out, err, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect({ code, err }).toEqual({ code: 0, err: "" })
    expect(out).toContain("1 file changed")
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})
