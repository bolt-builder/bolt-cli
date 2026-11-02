import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"
import { workflowServer } from "./fixture/workflow-server"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("figma fetches and simplifies designs, handles API failures and sends output scope to the build agent", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-figma-command-"))
  const out = path.join(home, "components")
  let mode = "valid"
  let calls = 0
  let leaked = false
  const target = Bun.serve({
    port: 0,
    fetch() {
      leaked = true
      return new Response("unexpected")
    },
  })
  const api = Bun.serve({
    port: 0,
    fetch(request) {
      calls++
      expect(request.headers.get("X-Figma-Token")).toBe("fixture-figma-secret")
      const url = new URL(request.url)
      expect(url.pathname).toBe("/v1/files/ABC123/nodes")
      expect(url.searchParams.get("ids")).toBe("1:2")
      if (mode === "unauthorized") return new Response(null, { status: 403 })
      if (mode === "redirect") return Response.redirect(target.url.toString())
      if (mode === "missing") return Response.json({ nodes: {} })
      return Response.json({
        nodes: {
          "1:2": {
            document: {
              type: "FRAME",
              name: "Card",
              layoutMode: "VERTICAL",
              fills: [{ type: "SOLID", color: { r: 0.2, g: 0.4, b: 0.8 } }],
              children: [{ type: "TEXT", characters: "Hello" }],
            },
          },
        },
      })
    },
  })
  const fixture = workflowServer(async ({ agent, text }) => {
    expect(agent).toBe("build")
    expect(text).toContain(`Output directory: ${out}`)
    expect(text).toContain('"layout": "vertical"')
    expect(text).toContain('"text": "Hello"')
    expect(text).toContain("#3366cc")
    await fs.mkdir(out, { recursive: true })
    await Bun.write(path.join(out, "card.tsx"), "export const Card = () => <div>Hello</div>\n")
    return "card.tsx — generated Card component"
  })
  const cli = async (url: string, token = "fixture-figma-secret") => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "figma",
        url,
        "--out",
        "components",
        "--model",
        "fixture/model#fast",
        "--server",
        fixture.server.url.toString(),
      ],
      {
        cwd: home,
        env: isolatedEnv(home, { FIGMA_TOKEN: token, BOLT_FIGMA_API_URL: api.url.toString() }),
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
    expect(stdout + stderr).not.toContain("fixture-figma-secret")
    return { stdout, stderr, code }
  }
  const url = "https://www.figma.com/design/ABC123/Card?node-id=1-2"
  try {
    expect((await cli("https://example.com/design/ABC123?node-id=1-2")).code).toBe(1)
    expect((await cli("https://www.figma.com/design/ABC123/Card")).stderr).toContain("no node-id")
    expect((await cli(url, "")).stderr).toContain("FIGMA_TOKEN is not set")
    expect(calls).toBe(0)
    const generated = await cli(url)
    expect(generated.code, generated.stderr).toBe(0)
    expect(generated.stdout).toContain("card.tsx")
    expect(await Bun.file(path.join(out, "card.tsx")).text()).toContain("Hello")
    expect([...fixture.sessions.values()][0]!.permissions).toEqual(
      expect.arrayContaining([{ action: "external_directory", resource: path.join(out, "*"), effect: "allow" }]),
    )
    mode = "unauthorized"
    const denied = await cli(url)
    expect(denied.code).toBe(1)
    expect(denied.stderr).toContain("API returned 403")
    mode = "missing"
    expect((await cli(url)).stderr).toContain("Node 1:2 was not found")
    mode = "redirect"
    expect((await cli(url)).code).toBe(1)
    expect(leaked).toBe(false)
    expect(fixture.sessions.size).toBe(1)
    expect(fixture.removed).toHaveLength(1)
  } finally {
    await fixture.server.stop(true)
    await api.stop(true)
    await target.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 30_000)
