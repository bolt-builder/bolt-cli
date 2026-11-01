import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { initRepo } from "../../core/test/fixture/git"
import { isolatedEnv } from "./fixture/environment"
import { workflowServer } from "./fixture/workflow-server"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("codemod runs real ast-grep with preview, explicit apply and generated read-only transforms", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-codemod-command-"))
  const project = path.join(home, "project")
  const source = path.join(project, "example.ts")
  await fs.mkdir(project)
  await initRepo(project)
  await Bun.write(source, 'console.log("hello")\n')
  const fixture = workflowServer(async ({ agent, text }) => {
    expect(agent).toBe("plan")
    expect(text).toContain("Requested transform: replace the logger")
    return '```json\n{"pattern":"console.log($$$ARGS)","rewrite":"logger.info($$$ARGS)","lang":"typescript"}\n```'
  })
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "codemod",
        ...args,
        "--server",
        fixture.server.url.toString(),
      ],
      {
        cwd: project,
        env: {
          ...isolatedEnv(home),
          PATH: [path.resolve(import.meta.dir, "../../../node_modules/.bin"), process.env.PATH]
            .filter(Boolean)
            .join(path.delimiter),
        },
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
    const args = ["--pattern", "console.log($$$ARGS)", "--rewrite", "logger.info($$$ARGS)", "--lang", "typescript"]
    const preview = await cli(...args)
    expect(preview.code, preview.stderr).toBe(0)
    expect(preview.stdout).toContain("1 rewrite(s) in 1 file(s)")
    expect(preview.stdout).toContain('logger.info("hello")')
    expect(preview.stdout).toContain("Preview only")
    expect(await Bun.file(source).text()).toBe('console.log("hello")\n')
    expect(fixture.sessions.size).toBe(0)
    const generated = await cli("replace the logger", "--model", "fixture/model#fast")
    expect(generated.code, generated.stderr).toBe(0)
    expect(generated.stdout).toContain("Generating transform")
    expect(await Bun.file(source).text()).toBe('console.log("hello")\n')
    expect(fixture.removed).toHaveLength(1)
    const permissions = [...fixture.sessions.values()][0]!.permissions
    expect(permissions).toEqual(
      expect.arrayContaining([
        { action: "edit", resource: "*", effect: "deny" },
        { action: "shell", resource: "*", effect: "deny" },
      ]),
    )
    const applied = await cli(...args, "--apply")
    expect(applied.code, applied.stderr).toBe(0)
    expect(applied.stdout).toContain("Applied 1 rewrite(s)")
    expect(await Bun.file(source).text()).toBe('logger.info("hello")\n')
    const none = await cli(...args)
    expect(none.code, none.stderr).toBe(0)
    expect(none.stdout).toContain("No matches found")
    const invalid = await cli("--pattern", "console.log($$$ARGS)")
    expect(invalid.code).toBe(1)
    expect(invalid.stderr).toContain("provided together")
    const language = await cli(...args.slice(0, -2), "--lang", "invalid-language")
    expect(language.code).toBe(1)
    expect(language.stderr).toContain("invalid-language")
    expect(fixture.sessions.size).toBe(1)
  } finally {
    fixture.server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 30_000)
