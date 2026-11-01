import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { isolatedEnv } from "./fixture/environment"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("checkpoint CLI transports named operations, selects the latest root and retains repo-only and alias behavior", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-checkpoint-command-"))
  const calls: { method: string; input: Record<string, unknown> }[] = []
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/api/info") return Response.json({ version: "local" })
      if (url.pathname === "/api/location")
        return Response.json({ directory: home, project: { id: "prj_checkpoint", directory: home, canonical: home } })
      if (url.pathname === "/api/session") {
        expect(url.searchParams.get("parentID")).toBe("null")
        expect(url.searchParams.get("limit")).toBe("1")
        return Response.json({ data: [{ id: "ses_latest" }] })
      }
      if (url.pathname.startsWith("/api/rpc/bolt.checkpoint/")) {
        const method = url.pathname.split("/").at(-1)!
        const body = await request.json()
        calls.push({ method, input: body.input })
        expect(url.searchParams.get("location[directory]")).toBe(home)
        if (body.input.name === "missing")
          return Response.json(
            { error: { type: "failed", message: "No checkpoint named missing.", data: {} } },
            { status: 400 },
          )
        const info = { name: body.input.name ?? "before", time: Date.now(), snapshot: "abc", ...body.input }
        return Response.json({
          output: method === "list" ? [info] : method === "remove" ? { removed: body.input.name } : info,
        })
      }
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
        "checkpoint",
        ...args,
        "--server",
        server.url.toString(),
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
    const save = await cli("save", "before")
    expect(save.code, save.stderr).toBe(0)
    expect(save.stdout).toContain("session ses_latest")
    const repo = await cli("save", "repo", "--repo-only", "-s", "ses_ignore")
    expect(repo.code, repo.stderr).toBe(0)
    expect(repo.stdout).toContain("repo only")
    const explicit = await cli("save", "explicit", "-s", "ses_explicit")
    expect(explicit.code, explicit.stderr).toBe(0)
    expect(explicit.stdout).toContain("ses_explicit")
    expect((await cli("ls")).stdout).toContain("before")
    expect((await cli("rewind", "before")).stdout).toContain("Repo restored")
    expect((await cli("rm", "before")).stdout).toContain("Removed checkpoint")
    const count = calls.length
    const invalid = await cli("save", "../unsafe")
    expect(invalid.code).toBe(1)
    expect(invalid.stderr).toContain("Invalid checkpoint name")
    expect(calls).toHaveLength(count)
    expect(calls.slice(0, 3)).toEqual([
      { method: "save", input: { name: "before", sessionID: "ses_latest" } },
      { method: "save", input: { name: "repo" } },
      { method: "save", input: { name: "explicit", sessionID: "ses_explicit" } },
    ])
    expect((await cli("rewind", "missing")).code).toBe(1)
  } finally {
    server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 30_000)
