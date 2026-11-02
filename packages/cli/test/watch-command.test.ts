import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { initRepo } from "../../core/test/fixture/git"
import { isolatedEnv } from "./fixture/environment"
import { workflowServer } from "./fixture/workflow-server"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("watch reruns real changes, reuses its repair session, limits attempts and stops cleanly", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-watch-command-"))
  const project = path.join(home, "project")
  await fs.mkdir(project)
  await initRepo(project)
  await Bun.write(path.join(project, "state.cjs"), "module.exports = 0\n")
  await Bun.write(
    path.join(project, "check.cjs"),
    'const n = require("./state.cjs");console.log("RUN_"+n);if(n){console.log("x".repeat(30000)+"FINAL_FAILURE");process.exitCode=1}',
  )
  let fix = true
  const fixture = workflowServer(async ({ text, prompts }) => {
    expect(text).toContain("FINAL_FAILURE")
    expect(text.length).toBeLessThan(22000)
    expect(text).toContain("Do not skip, delete, or weaken tests")
    if (fix && prompts.length === 2) await Bun.write(path.join(project, "state.cjs"), "module.exports = 0\n")
    return "Investigated the failing command"
  })
  const child = Bun.spawn(
    [
      process.execPath,
      "run",
      "--jsx-import-source=@opentui/solid",
      entry,
      "watch",
      `"${process.execPath}" check.cjs`,
      "--fix",
      "--attempts",
      "2",
      "--model",
      "fixture/model#careful",
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
  const chunks: string[] = []
  const errors: string[] = []
  const stdout = (async () => {
    for await (const chunk of child.stdout) chunks.push(Buffer.from(chunk).toString())
  })()
  const stderr = (async () => {
    for await (const chunk of child.stderr) errors.push(Buffer.from(chunk).toString())
  })()
  const until = async (check: () => boolean) => {
    const deadline = Date.now() + 20000
    while (Date.now() < deadline) {
      if (check()) return
      if (child.exitCode !== null)
        throw new Error(`Watcher exited ${child.exitCode}: ${errors.join("")}\n${chunks.join("").slice(-2000)}`)
      await Bun.sleep(10)
    }
    throw new Error(`Watcher did not reach expected state: ${errors.join("")}\n${chunks.join("").slice(-2000)}`)
  }
  try {
    await until(() => chunks.join("").includes("Passed. Waiting for changes"))
    await Bun.write(path.join(project, "state.cjs"), "module.exports = 1\n")
    await until(
      () =>
        [...fixture.sessions.values()][0]?.prompts.length === 2 &&
        (chunks.join("").match(/Passed\. Waiting for changes/g)?.length ?? 0) >= 2,
    )
    expect(fixture.sessions.size).toBe(1)
    expect(fixture.removed).toHaveLength(0)
    fix = false
    await Bun.write(path.join(project, "state.cjs"), "module.exports = 2\n")
    await until(() => chunks.join("").includes("Giving up after 2 fix attempts"))
    expect([...fixture.sessions.values()][0]?.prompts).toHaveLength(4)
    expect(fixture.sessions.size).toBe(1)
    const before = chunks.join("").match(/Passed\. Waiting for changes/g)?.length ?? 0
    await Bun.write(path.join(project, "state.cjs"), "module.exports = 0\n")
    await until(() => (chunks.join("").match(/Passed\. Waiting for changes/g)?.length ?? 0) > before)
    child.kill("SIGINT")
    await child.exited
    await stdout
    await stderr
    expect(errors.join("")).not.toContain("unhandled")
  } finally {
    child.kill()
    await child.exited
    await Promise.all([stdout, stderr])
    await fixture.server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
})
