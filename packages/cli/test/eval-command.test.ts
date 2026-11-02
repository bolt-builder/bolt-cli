import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"
import { workflowServer } from "./fixture/workflow-server"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("eval grades isolated cases, reports JSON, keeps requested workspaces and interrupts timeouts", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-eval-command-"))
  const evals = path.join(home, "evals")
  await fs.mkdir(evals)
  await Bun.write(
    path.join(evals, "a-fail.md"),
    "---\nexpect:\n  - type: file_exists\n    path: missing.txt\n---\nDo nothing.",
  )
  await Bun.write(
    path.join(evals, "b-pass.md"),
    "---\nfiles:\n  input.txt: seed\nexpect:\n  - type: file_contains\n    path: out.txt\n    text: hello\n  - type: command\n    run: echo checked\n---\nCreate out.txt containing hello.",
  )
  const directories: string[] = []
  const fixture = workflowServer(async ({ agent, text, directory }) => {
    expect(agent).toBe("build")
    directories.push(directory)
    if (text.includes("Create")) {
      expect(await Bun.file(path.join(directory, "input.txt")).text()).toBe("seed")
      await Bun.write(path.join(directory, "out.txt"), "hello\n")
    }
    if (text.includes("Wait")) await Bun.sleep(1000)
    return "done"
  })
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "eval",
        ...args,
        "--server",
        fixture.server.url.toString(),
      ],
      {
        cwd: home,
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
    const missing = await cli("does-not-exist")
    expect(missing.code).toBe(1)
    expect(missing.stderr).toContain("does-not-exist")
    const graded = await cli("--format", "json", "--model", "fixture/model#fast")
    expect(graded.code, graded.stderr).toBe(1)
    const events = graded.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
    expect(events.filter((event) => event.type === "eval_case").map((event) => [event.name, event.passed])).toEqual([
      ["a-fail", false],
      ["b-pass", true],
    ])
    expect(events.at(-1)).toMatchObject({ type: "eval_summary", total: 2, passed: 1, failed: 1 })
    expect(directories[0]).not.toBe(directories[1])
    for (const directory of directories) expect(await Bun.file(path.join(directory, "out.txt")).exists()).toBe(false)
    expect(fixture.removed).toHaveLength(0)
    const kept = await cli(path.join(evals, "b-pass.md"), "--keep", "--format", "json")
    expect(kept.code, kept.stderr).toBe(0)
    const retained = JSON.parse(kept.stdout.split("\n")[0])
    expect(retained.workspace).toBe(directories.at(-1))
    expect(await Bun.file(path.join(retained.workspace, "out.txt")).text()).toBe("hello\n")
    await Bun.write(path.join(evals, "timeout.md"), "---\nexpect: []\n---\nWait for a slow answer.")
    const timeout = await cli(path.join(evals, "timeout.md"), "--timeout", "0.25", "--format", "json")
    expect(timeout.code, timeout.stderr).toBe(5)
    expect(JSON.parse(timeout.stdout.split("\n")[0])).toMatchObject({
      passed: false,
      errors: ["timed out after 0.25s"],
    })
    await Bun.write(
      path.join(evals, "escape.md"),
      "---\nfiles:\n  ../escaped.txt: forbidden\nexpect: []\n---\nDo nothing.",
    )
    const escape = await cli(path.join(evals, "escape.md"))
    expect(escape.code).toBe(1)
    expect(escape.stderr).toContain("escapes its workspace")
    expect(await Bun.file(path.join(os.tmpdir(), "escaped.txt")).exists()).toBe(false)
    await fs.rm(retained.workspace, { recursive: true, force: true })
  } finally {
    await fixture.server.stop(true)
    for (const directory of directories) await fs.rm(directory, { recursive: true, force: true })
    await fs.rm(home, { recursive: true, force: true })
  }
}, 30_000)
