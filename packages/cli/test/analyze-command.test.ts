import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

test("analyze runs project scripts, reports dead exports and preserves staged/branch selection", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-analyze-"))
  const root = path.join(home, "project")
  await fs.mkdir(root)
  const run = async (args: string[]) => {
    const child = Bun.spawn(args, {
      cwd: root,
      env: isolatedEnv(home),
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
  const git = async (...args: string[]) => expect((await run(["git", ...args])).code).toBe(0)
  const cli = (...args: string[]) =>
    run([
      process.execPath,
      "run",
      "--jsx-import-source=@opentui/solid",
      path.resolve(import.meta.dir, "../src/index.ts"),
      "analyze",
      ...args,
    ])
  try {
    await git("init", "-q", "-b", "main")
    await Bun.write(
      path.join(root, "package.json"),
      JSON.stringify({ scripts: { lint: "exit 0", typecheck: "exit 0" } }),
    )
    await Bun.write(path.join(root, "bun.lock"), "")
    await Bun.write(path.join(root, "api.ts"), "export const used = 1\n")
    await Bun.write(path.join(root, "caller.ts"), "console.log(used)\n")
    await git("add", ".")
    await git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "initial")
    expect(await cli()).toMatchObject({ code: 0, stdout: "Nothing to analyze.\n" })
    await Bun.write(path.join(root, "api.ts"), "export const used = 2\nexport function unused() {}\n")
    const warnings = await cli()
    expect(warnings.code).toBe(0)
    expect(warnings.stdout).toContain("lint: pass")
    expect(warnings.stdout).toContain("typecheck: pass")
    expect(warnings.stdout).toContain("api.ts:2 unused")
    expect(warnings.stdout).not.toContain("api.ts:1 used")
    expect(warnings.stdout).toContain("Verdict: pass with warnings")
    expect((await cli("--staged")).stdout).toBe("Nothing to analyze.\n")
    await git("checkout", "-qb", "feature")
    await git("add", ".")
    await git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "change")
    for (const flags of [["--branch=main"], ["--branch", "main"], ["--branch"]])
      expect((await cli(...flags)).stdout).toContain("api.ts:2 unused")
    await Bun.write(
      path.join(root, "package.json"),
      JSON.stringify({ scripts: { lint: "echo fixture-lint-error; exit 3" } }),
    )
    const failed = await cli("--branch=main")
    expect(failed.code).toBe(1)
    expect(failed.stdout).toContain("lint: FAIL (exit 3)")
    expect(failed.stdout).toContain("fixture-lint-error")
    expect(failed.stdout).toContain('typecheck: no "typecheck" script')
    expect(failed.stdout).toContain("Verdict: FAIL")
    expect((await cli("--staged", "--branch=main")).code).toBe(1)
    await git("checkout", "-q", "--", "package.json")
    await git("rm", "-q", "caller.ts")
    const deleted = await cli()
    expect(deleted.stdout).toContain("Analyzing 1 changed file...")
    expect(deleted.stdout).toContain("lint: pass")
    expect(deleted.stdout).toContain("typecheck: pass")
    await git("reset", "-q", "--hard")
    await git("mv", "api.ts", "renamed.ts")
    expect((await cli("--staged")).stdout).toContain("Analyzing 1 changed file...")
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})
