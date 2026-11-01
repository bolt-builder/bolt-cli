import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"
import { verdict } from "../src/commands/handlers/flaky"

describe("verdict", () => {
  test("all zero exit codes are a stable pass", () => {
    expect(verdict([0, 0, 0])).toBe("pass")
  })

  test("all failing exit codes are a stable fail", () => {
    expect(verdict([1, 1, 2])).toBe("fail")
  })

  test("mixed exit codes are flaky", () => {
    expect(verdict([0, 1, 0])).toBe("flaky")
  })

  test("empty input has no verdict", () => {
    expect(verdict([])).toBeUndefined()
  })
})

test("real flaky command preserves pass/fail/mixed exit codes and quarantine ownership", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-flaky-"))
  const cli = async (command: string, ...flags: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        path.resolve(import.meta.dir, "../src/index.ts"),
        "flaky",
        command,
        "--runs",
        "2",
        ...flags,
      ],
      { cwd: root, env: isolatedEnv(root), stdout: "pipe", stderr: "pipe", stdin: "ignore" },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  try {
    expect((await cli("exit 0")).code).toBe(0)
    expect((await cli("exit 3")).code).toBe(1)
    const command = "if [ -f ran ]; then rm ran; exit 0; else touch ran; exit 1; fi"
    const mixed = await cli(command, "--quarantine")
    expect(mixed.code).toBe(2)
    expect(mixed.stdout).toContain("1/2 passed.")
    const file = path.join(root, ".bolt", "quarantine.json")
    const quarantined = await Bun.file(file).json()
    expect(quarantined).toHaveLength(1)
    expect(quarantined[0]).toMatchObject({ command, passes: 1, runs: 2 })
    expect((await cli(command, "--quarantine")).code).toBe(2)
    expect(await Bun.file(file).json()).toHaveLength(1)
    const parallel = ["a", "b"].map(
      (name) => `if [ -f ran_${name} ]; then rm ran_${name}; exit 0; else touch ran_${name}; exit 1; fi`,
    )
    const results = await Promise.all(parallel.map((value) => cli(value, "--quarantine")))
    expect(results.map((value) => value.code)).toEqual([2, 2])
    expect((await Bun.file(file).json()).map((item: { command: string }) => item.command)).toEqual(
      expect.arrayContaining(parallel),
    )
    await Bun.write(file, '{"invalid": true}')
    expect((await cli(command, "--quarantine")).code).toBe(2)
    expect(await Bun.file(file).text()).toBe('{"invalid": true}')
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
