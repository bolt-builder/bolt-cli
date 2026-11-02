import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { isolatedEnv } from "./fixture/environment"
import { initRepo, git } from "../../core/test/fixture/git"

const entry = path.resolve(import.meta.dir, "../src/index.ts")

test("configuration CLI preserves JSONC and legacy fields, validates edits, resolves sources and compares tracked deletions", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-config-command-"))
  const project = path.join(home, "project with spaces")
  await fs.mkdir(project)
  const file = path.join(project, "bolt.jsonc")
  const original =
    '{\n  // preserve this preference\n  "username": "before",\n  "snapshot": true,\n  "unknown_future": { "keep": true }\n}\n'
  await Bun.write(file, original)
  await initRepo(project)
  await git(project, "add", "bolt.jsonc")
  await git(project, "commit", "-m", "configuration")
  const global = path.join(home, "config", "bolt.jsonc")
  await Bun.write(global, '{"username":"global","instructions":["GLOBAL.md"]}')
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/api/info") return Response.json({ version: "local" })
      if (url.pathname === "/api/location")
        return Response.json({
          directory: project,
          project: { directory: project, canonical: project, id: "prj_config" },
        })
      if (url.pathname === "/api/config")
        return Response.json([
          {
            type: "document",
            path: global,
            info: {
              username: "global",
              model: { providerID: "old", model: "old", variant: "high" },
              mcp: { servers: { example: { type: "local", command: ["old"] } } },
              instructions: ["GLOBAL.md"],
              providers: { example: { name: "Example", env: ["EXAMPLE_TOKEN"] } },
            },
          },
          {
            type: "document",
            path: file,
            info: {
              username: "project",
              model: { providerID: "new", model: "new" },
              mcp: { servers: { example: { type: "remote", url: "https://mcp.invalid" } } },
              instructions: ["PROJECT.md"],
              providers: { example: { baseURL: "https://example.invalid" } },
            },
          },
        ])
      return new Response(null, { status: 404 })
    },
  })
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "config",
        ...args,
        "--server",
        server.url.toString(),
      ],
      { cwd: project, env: isolatedEnv(home), stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  try {
    const set = await cli("set", "username", "1234")
    expect(set.code, set.stderr).toBe(0)
    expect(await Bun.file(file).text()).toContain('"username": "1234"')
    expect(await Bun.file(file).text()).toContain("// preserve this preference")
    expect(await Bun.file(file).text()).toContain('"snapshot": true')
    expect(await Bun.file(file).text()).toContain('"unknown_future": { "keep": true }')
    const before = await Bun.file(file).text()
    const invalid = await cli("set", "snapshots", "incorrect")
    expect(invalid.code).toBe(1)
    expect(await Bun.file(file).text()).toBe(before)
    const poison = await cli("set", "__proto__.polluted", "true")
    expect(poison.code).toBe(1)
    expect(await Bun.file(file).text()).toBe(before)
    const unset = await cli("unset", "username")
    expect(unset.code, unset.stderr).toBe(0)
    expect(await Bun.file(file).text()).not.toContain('"username"')
    const globalSet = await cli("set", "username", "new-global", "--global")
    expect(globalSet.code, globalSet.stderr).toBe(0)
    expect((await Bun.file(global).json()).username).toBe("new-global")
    const get = await cli("get", "username")
    expect(get.code, get.stderr).toBe(0)
    expect(get.stdout.trim()).toBe("project")
    const instructions = await cli("get", "instructions")
    expect(JSON.parse(instructions.stdout)).toEqual(["GLOBAL.md", "PROJECT.md"])
    const model = await cli("get", "model")
    expect(JSON.parse(model.stdout)).toEqual({ providerID: "new", model: "new" })
    const mcp = await cli("get", "mcp.servers.example")
    expect(JSON.parse(mcp.stdout)).toEqual({ type: "remote", url: "https://mcp.invalid" })
    const doctor = await cli("doctor")
    expect(doctor.code, doctor.stderr).toBe(0)
    expect(doctor.stdout).toContain(`username <- ${file}`)
    expect(doctor.stdout).toContain('"instructions" accumulates')
    const diff = await cli("diff")
    expect(diff.code, diff.stderr).toBe(0)
    expect(diff.stdout).toContain("- username (was")
    await fs.rm(file)
    const deleted = await cli("diff", "--patch")
    expect(deleted.code, deleted.stderr).toBe(0)
    expect(deleted.stdout).toContain('-  "username": "before"')
    await Bun.write(file, '{"username":')
    const malformed = await cli("set", "username", "do-not-overwrite")
    expect(malformed.code).toBe(1)
    expect(await Bun.file(file).text()).toBe('{"username":')
    const dot = path.join(project, ".bolt", "bolt.jsonc")
    await Bun.write(dot, '{"username":"effective-dot-directory"}')
    await Bun.write(path.join(project, ".opencode", "bolt.jsonc"), '{"username":"lower-precedence"}')
    const priority = await cli("set", "username", "updated-effective")
    expect(priority.code, priority.stderr).toBe(0)
    expect((await Bun.file(dot).json()).username).toBe("updated-effective")
    expect(await Bun.file(file).text()).toBe('{"username":')
  } finally {
    server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 60_000)
