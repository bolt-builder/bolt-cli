import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { isolatedEnv } from "./fixture/environment"
import { workflowServer } from "./fixture/workflow-server"

const entry = path.resolve(import.meta.dir, "../src/index.ts")

test("refactor continues its retained session with bounded failure tails, verifies green and reports exhausted attempts", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-refactor-command-"))
  let fix = true
  const fixture = workflowServer(async (input) => {
    if (input.prompts.length > 1 && fix) await Bun.write(path.join(home, "green"), "ready")
    return "Done.\nConfidence: high"
  })
  await Bun.write(
    path.join(home, "check.cjs"),
    'const fs = require("fs");if(!fs.existsSync("green")){process.stdout.write("x".repeat(60000)+"\\nFINAL_FAILURE_DETAIL");process.stderr.write("y".repeat(60000)+"\\nFINAL_ERROR_DETAIL");process.exitCode=1}',
  )
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "refactor",
        "restore behavior",
        "--test",
        `"${process.execPath}" check.cjs`,
        "--server",
        fixture.server.url.toString(),
        ...args,
      ],
      { cwd: home, env: isolatedEnv(home), stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  try {
    const success = await cli("--attempts", "2", "--confidence")
    expect(success.code, success.stderr).toBe(0)
    expect(success.stdout).toContain("Tests are green")
    expect(success.stdout).toContain("Confidence: HIGH")
    expect(fixture.sessions.size).toBe(1)
    const prompts = [...fixture.sessions.values()][0]!.prompts
    expect(prompts).toHaveLength(2)
    expect(prompts[1]).toContain("FINAL_FAILURE_DETAIL")
    expect(prompts[1]).toContain("FINAL_ERROR_DETAIL")
    expect(prompts[1]!.length).toBeLessThan(21_000)
    expect(fixture.removed).toEqual([])
    await fs.rm(path.join(home, "green"))
    fix = false
    const failed = await cli("--attempts", "1")
    expect(failed.code).toBe(1)
    expect(failed.stderr).toContain("Tests still failing after 1 attempt")
  } finally {
    fixture.server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 30_000)
