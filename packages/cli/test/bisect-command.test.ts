import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { initRepo } from "../../core/test/fixture/git"
import { isolatedEnv } from "./fixture/environment"
import { workflowServer } from "./fixture/workflow-server"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
for (const mode of ["locate", "fix", "passing HEAD", "failing good"] as const)
  test(`bisect preserves the checkout and cleans worktrees: ${mode}`, async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-bisect-command-"))
    const project = path.join(home, "project")
    await fs.mkdir(project)
    await initRepo(project)
    const git = (...args: string[]) => {
      const run = Bun.spawnSync(["git", ...args], {
        cwd: project,
        env: isolatedEnv(home),
        stdout: "pipe",
        stderr: "pipe",
      })
      expect(run.exitCode, run.stderr.toString()).toBe(0)
      return run.stdout.toString().trim()
    }
    const commit = async (source: string, name: string) => {
      await Bun.write(path.join(project, "state.cjs"), source)
      git("add", ".")
      git("commit", "-m", name)
      return git("rev-parse", "HEAD")
    }
    const good = await commit("process.exitCode = 0\n", "passing")
    await Bun.write(path.join(project, "README"), "unrelated\n")
    await commit("process.exitCode = 0\n", "still passing")
    const culprit = await commit("process.exitCode = 1\n", "broken behavior")
    const head = await commit("// later\nprocess.exitCode = 1\n", "later change")
    const branch = git("symbolic-ref", "HEAD")
    const original = "// user uncommitted edit\nprocess.exitCode = 1\n"
    await Bun.write(path.join(project, "state.cjs"), original)
    await Bun.write(path.join(project, "untracked"), "keep")
    const fixture = workflowServer(async ({ agent, text }) => {
      expect(agent).toBe("ask")
      expect(text).toContain(culprit)
      expect(text).toContain("Do not edit any files")
      return "The culprit changed the exit status.\n```diff\n-process.exitCode = 1\n+process.exitCode = 0\n```"
    })
    const cli = async (command: string, ...args: string[]) => {
      const child = Bun.spawn(
        [
          process.execPath,
          "run",
          "--jsx-import-source=@opentui/solid",
          entry,
          "bisect",
          command,
          "--good",
          good,
          "--server",
          fixture.server.url.toString(),
          ...args,
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
      expect(git("symbolic-ref", "HEAD")).toBe(branch)
      expect(git("rev-parse", "HEAD")).toBe(head)
      expect(await Bun.file(path.join(project, "state.cjs")).text()).toBe(original)
      expect(await Bun.file(path.join(project, "untracked")).text()).toBe("keep")
      expect(git("worktree", "list", "--porcelain").match(/^worktree /gm)).toHaveLength(1)
      return { stdout, stderr, code }
    }
    try {
      if (mode === "locate") {
        const found = await cli(`"${process.execPath}" state.cjs`)
        expect(found.code, found.stderr).toBe(0)
        expect(found.stdout).toContain(`commit ${culprit}`)
        expect(found.stdout).toContain("Culprit found")
        expect(found.stdout).toContain("unsigned")
      }
      if (mode === "fix") {
        const fixed = await cli(`"${process.execPath}" state.cjs`, "--fix", "--model", "fixture/model#careful")
        expect(fixed.code, fixed.stderr).toBe(0)
        expect(fixed.stdout).toContain("The culprit changed the exit status")
        expect(fixture.removed).toHaveLength(1)
        expect([...fixture.sessions.values()][0]?.permissions).toEqual(
          expect.arrayContaining([
            { action: "edit", resource: "*", effect: "deny" },
            { action: "memory_save", resource: "*", effect: "deny" },
          ]),
        )
      }
      if (mode === "passing HEAD") {
        const pass = await cli(`"${process.execPath}" -e "process.exit(0)"`)
        expect(pass.code).toBe(1)
        expect(pass.stderr).toContain("passes on HEAD")
      }
      if (mode === "failing good") {
        const fail = await cli(`"${process.execPath}" -e "process.exit(1)"`)
        expect(fail.code).toBe(1)
        expect(fail.stderr).toContain("also fails on --good")
      }
    } finally {
      fixture.server.stop(true)
      await fs.rm(home, { recursive: true, force: true })
    }
  })
