import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { isolatedEnv } from "./fixture/environment"

const entry = path.resolve(import.meta.dir, "../src/index.ts")

test("worktree commands retain the canonical checkout and dirty-worktree protection; warm builds and skips the source index", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-worktree-command-"))
  const root = path.join(home, "project")
  const alpha = path.join(home, "alpha")
  const beta = path.join(home, "beta")
  const directories = new Set([root, alpha, beta])
  const removed: string[] = []
  const started: unknown[] = []
  const requests: string[] = []
  let dirty = true
  await fs.mkdir(root)
  const location = { directory: root, project: { id: "prj_fixture", directory: root, canonical: root } }
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      requests.push(url.pathname)
      if (url.pathname === "/api/info") return Response.json({ version: "local" })
      if (url.pathname === "/api/location") return Response.json(location)
      if (url.pathname === "/api/config" || url.pathname === "/api/model") return Response.json([])
      if (url.pathname === "/api/vcs") return Response.json({ location, data: { branch: { current: "bolt/alpha" } } })
      if (url.pathname === "/api/worktree" && request.method === "GET")
        return Response.json([...directories].map((directory) => ({ directory })))
      if (url.pathname === "/api/worktree" && request.method === "POST") {
        const input = await request.json()
        expect(input).toEqual({ projectID: "prj_fixture", from: root, name: "gamma" })
        const directory = path.join(home, input.name)
        directories.add(directory)
        return Response.json({ directory })
      }
      if (url.pathname === "/api/shell" && request.method === "POST") {
        started.push(await request.json())
        return Response.json({ location, data: { id: "sh_fixture", status: "running" } })
      }
      if (url.pathname === "/api/worktree" && request.method === "DELETE") {
        const input = await request.json()
        expect(input.force).toBe(false)
        expect(input.directory).not.toBe(root)
        if (dirty && input.directory === alpha)
          return Response.json(
            {
              _tag: "WorktreeError",
              name: "WorktreeError",
              data: { message: "Worktree has uncommitted changes", forceRequired: true },
            },
            { status: 400 },
          )
        directories.delete(input.directory)
        removed.push(input.directory)
        return new Response(null, { status: 204 })
      }
      return new Response("unexpected " + url.pathname, { status: 404 })
    },
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
        server.url.toString(),
      ],
      { cwd: root, env: isolatedEnv(home), stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  try {
    const list = await cli("worktree", "list")
    expect(list.code, list.stderr).toBe(0)
    expect(list.stdout).toContain(alpha)
    expect(list.stdout).not.toContain(root)
    const create = await cli("worktree", "create", "gamma", "--start", "bun dev")
    expect(create.code, create.stderr).toBe(0)
    expect(started).toEqual([{ command: "bun dev", cwd: path.join(home, "gamma") }])
    const ambiguous = await cli("worktree", "remove", "bolt/alpha")
    expect(ambiguous.code).toBe(1)
    expect(removed).toEqual([])
    const preview = await cli("worktree", "clean")
    expect(preview.code, preview.stderr).toBe(0)
    expect(preview.stdout).toContain("Would remove")
    expect(removed).toEqual([])
    const clean = await cli("worktree", "clean", "--apply")
    expect(clean.code).toBe(1)
    expect(clean.stderr).toContain("uncommitted changes")
    expect(removed).toContain(beta)
    expect(directories.has(root)).toBe(true)
    expect(directories.has(alpha)).toBe(true)
    dirty = false
    expect((await cli("worktree", "rm", "alpha")).code).toBe(0)
    await Bun.write(path.join(root, "source.ts"), "export const restored = true\n")
    const warm = await cli("warm")
    expect(warm.code, warm.stderr).toBe(0)
    expect(warm.stdout).toContain("warm complete")
    expect((await Bun.file(path.join(root, "codebase-index.json")).json()).files["source.ts"]).toBeDefined()
    await fs.rm(path.join(root, "codebase-index.json"))
    const noIndex = await cli("warm", "--no-index")
    expect(noIndex.code, noIndex.stderr).toBe(0)
    expect(await Bun.file(path.join(root, "codebase-index.json")).exists()).toBe(false)
    expect(requests).toContain("/api/config")
    expect(requests).toContain("/api/model")
  } finally {
    server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 60_000)
