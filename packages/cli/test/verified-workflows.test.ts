import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"
import { workflowServer } from "./fixture/workflow-server"

const entry = path.resolve(import.meta.dir, "../src/index.ts")

test("pipeline retries review defects and guard/property workflows verify actual test command results", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-verified-workflows-"))
  let mode: "pipeline" | "guard" | "proptest" | "missing" = "pipeline"
  let reviews = 0
  let success = false
  const fixture = workflowServer(async (input) => {
    if (mode === "pipeline") {
      if (input.agent === "plan") return "1. Update tracked.txt with the complete fix."
      if (input.agent === "build") {
        await Bun.write(path.join(home, "tracked.txt"), reviews ? "complete fix\n" : "partial fix\n")
        return "Implemented the plan."
      }
      return ++reviews === 1 ? "- tracked.txt:1 incomplete fix\nVerdict: FAIL" : "Verdict: PASS"
    }
    if (mode === "missing") return "Test: missing.test.ts\nCommand: must-not-run"
    const file = mode === "guard" ? "regression.test.ts" : "properties.test.ts"
    await Bun.write(path.join(home, file), "// synthetic agent-created test\n")
    return `Test: ${file}\nCommand: "${process.execPath}" -e "process.exit(${success ? 0 : 1})"`
  })
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        ...args,
        "--server",
        fixture.server.url.toString(),
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
  const git = async (...args: string[]) => {
    const child = Bun.spawn(["git", "-c", "core.autocrlf=false", ...args], {
      cwd: home,
      stdout: "ignore",
      stderr: "pipe",
      env: isolatedEnv(home),
    })
    const stderr = new Response(child.stderr).text()
    expect(await child.exited, await stderr).toBe(0)
  }
  try {
    await git("init")
    await git("config", "user.name", "Workflow fixture")
    await git("config", "user.email", "fixture@example.invalid")
    await Bun.write(path.join(home, "tracked.txt"), "before\n")
    await git("add", "tracked.txt")
    await git("commit", "-m", "initial")
    const pipeline = await cli("pipeline", "complete the change", "--attempts", "2")
    expect(pipeline.code, pipeline.stderr).toBe(0)
    expect(pipeline.stdout).toContain("Pipeline passed review.")
    expect([...fixture.sessions.values()].map((item) => item.agent)).toEqual([
      "plan",
      "build",
      "code-review",
      "build",
      "code-review",
    ])
    const builds = [...fixture.sessions.values()].filter((item) => item.agent === "build")
    expect(builds[1]!.prompts[0]).toContain("tracked.txt:1 incomplete fix")
    expect(await Bun.file(path.join(home, "tracked.txt")).text()).toBe("complete fix\n")
    expect(fixture.removed).toEqual([])
    mode = "guard"
    const guard = await cli("guard", "reproduce the bug")
    expect(guard.code, guard.stderr).toBe(0)
    expect(guard.stdout).toContain("The test fails as expected (exit 1)")
    success = true
    const passingGuard = await cli("guard", "wrong reproduction")
    expect(passingGuard.code).toBe(1)
    expect(passingGuard.stderr).toContain("does not reproduce the bug")
    mode = "proptest"
    await Bun.write(path.join(home, "source.ts"), "export function parse(value: string) { return value.trim() }\n")
    const property = await cli("proptest", "source.ts", "--name", "parse")
    expect(property.code, property.stderr).toBe(0)
    expect(property.stdout).toContain("All properties hold")
    success = false
    const failedProperty = await cli("proptest", "source.ts")
    expect(failedProperty.code).toBe(1)
    expect(failedProperty.stderr).toContain("generated properties FAIL")
    mode = "missing"
    const missing = await cli("guard", "missing output")
    expect(missing.code).toBe(1)
    expect(missing.stderr).toContain("that file does not exist")
    expect(missing.stderr).not.toContain("Command failed")
  } finally {
    fixture.server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 60_000)
