import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

test("asserts and tighten select explicit paths, working changes and committed branch changes", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-type-checks-"))
  const root = path.join(home, "project")
  await fs.mkdir(root)
  const run = async (args: string[], cwd = root) => {
    const child = Bun.spawn(args, { cwd, env: isolatedEnv(home), stdin: "ignore", stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  const git = async (...args: string[]) => expect((await run(["git", ...args])).code).toBe(0)
  const cli = (command: string, args: string[] = [], cwd = root) =>
    run(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        path.resolve(import.meta.dir, "../src/index.ts"),
        command,
        ...args,
      ],
      cwd,
    )
  try {
    await Bun.write(path.join(root, "space name.test.ts"), 'test("vague", () => { expect(value).toBeTruthy() })\n')
    const explicit = await cli("asserts", ["space name.test.ts"])
    expect(explicit.code).toBe(1)
    expect(explicit.stdout).toContain("space name.test.ts:1 [only weak assertions] vague")
    expect((await cli("asserts")).code).toBe(1)
    await git("init", "-q", "-b", "main")
    await Bun.write(path.join(root, "types.ts"), "const value: string = 'value'\n")
    await git("add", ".")
    await git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "initial")
    expect((await cli("asserts")).stdout).toBe("No test files to scan.\n")
    expect((await cli("tighten")).stdout).toBe("No TypeScript files to scan.\n")
    await Bun.write(path.join(root, "types.ts"), "const value: any = 'value'\n")
    await Bun.write(path.join(root, "space name.test.ts"), 'test("empty", () => {})\n')
    expect(await cli("tighten")).toMatchObject({ code: 1 })
    expect((await cli("asserts")).stdout).toContain("[no assertions] empty")
    await fs.mkdir(path.join(root, "nested"))
    expect((await cli("tighten", ["../types.ts"], path.join(root, "nested"))).stdout).toContain("types.ts:1 [: any]")
    await git("checkout", "-qb", "feature")
    await git("add", ".")
    await git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "introduce findings",
    )
    expect((await cli("asserts")).stdout).toBe("No test files to scan.\n")
    for (const command of ["asserts", "tighten"]) {
      for (const flags of [["--branch=main"], ["--branch", "main"], ["--branch"]])
        expect((await cli(command, flags)).code).toBe(1)
      expect((await cli(command, ["--branch=missing"])).code).toBe(1)
    }
    await Bun.write(path.join(root, "types.ts"), "const value: string = 'value'\n")
    expect(await cli("tighten", ["types.ts"])).toMatchObject({
      code: 0,
      stdout: "Scanned 1 file: no loose types found.\n",
    })
  } finally {
    await fs.rm(home, { recursive: true, force: true })
  }
})
