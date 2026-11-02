import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const entry = path.resolve(import.meta.dir, "../src/index.ts")

test("memory CLI transports all management operations and keeps exports on the client", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-memory-cli-"))
  const operations: unknown[] = []
  const generations: { prompt: string; model: unknown }[] = []
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/api/model/default")
        return Response.json({ data: { providerID: "fixture", id: "default" } })
      if (url.pathname === "/api/info") return Response.json({ version: "local" })
      if (url.pathname === "/api/rpc/bolt.memory/manage") {
        const body = await request.json()
        operations.push(body.input)
        return Response.json({
          output: {
            root: "/server/memory",
            text:
              body.input.action === "dossier"
                ? "## Memory entries\n- [project.md > Facts > tests] Use Bun."
                : "memory fixture",
            count: 2,
          },
        })
      }
      if (url.pathname === "/api/experimental/generate/text") {
        generations.push(await request.json())
        return Response.json({ data: { text: "Evidence answer" } })
      }
      return new Response(`Unexpected request ${url.pathname}`, { status: 500 })
    },
  })
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "memory",
        ...args,
        "--server",
        server.url.toString(),
      ],
      {
        cwd,
        env: { ...process.env, XDG_STATE_HOME: path.join(cwd, "state") },
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
    expect({ code, stderr: code ? stderr : "" }).toEqual({ code: 0, stderr: "" })
    return { stdout, stderr }
  }
  try {
    const exported = await cli("export", "--out", "memory.md")
    expect(exported).toEqual({ stdout: "", stderr: "Exported 2 memory entries to memory.md\n" })
    expect(await Bun.file(path.join(cwd, "memory.md")).text()).toBe("memory fixture")
    expect((await cli("import", "memory.md")).stdout).toBe("memory fixture\n")
    await cli("team", "init")
    await cli("team", "share", "runner")
    await cli("review", "on")
    await cli("diff", "--apply")
    await cli("conflicts", "--fix")
    await cli("search", "runner", "--limit", "3")
    expect((await cli("why", "why", "Bun", "--model", "fixture/model")).stdout).toBe("Evidence answer\n")
    expect((await cli("why", "variant", "--model", "fixture/model#fast")).stdout).toBe("Evidence answer\n")
    expect((await cli("why", "default", "model")).stdout).toBe("Evidence answer\n")
    expect(operations).toEqual([
      { action: "export" },
      { action: "import", text: "memory fixture" },
      { action: "team", operation: "init" },
      { action: "team", operation: "share", query: "runner" },
      { action: "review", enabled: true },
      { action: "diff", apply: true, discard: false },
      { action: "conflicts", fix: true },
      { action: "search", query: "runner", limit: 3 },
      { action: "dossier" },
      { action: "dossier" },
      { action: "dossier" },
    ])
    expect(generations).toHaveLength(3)
    expect(generations[1]?.model).toEqual({ providerID: "fixture", id: "model", variant: "fast" })
    expect(generations[2]?.model).toEqual({ providerID: "fixture", id: "default" })
    expect(generations[0]?.model).toEqual({ providerID: "fixture", id: "model" })
    expect(generations[0]?.prompt).toContain("Question:\nwhy Bun")
    expect(generations[0]?.prompt).toContain("[project.md > Facts > tests] Use Bun.")
    expect(generations[0]?.prompt).toContain("Do not use tools")
  } finally {
    await server.stop(true)
    await fs.rm(cwd, { recursive: true, force: true })
  }
})
