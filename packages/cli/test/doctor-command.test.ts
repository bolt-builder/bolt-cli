import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("doctor reports real disk/network/config/auth checks and continues through diagnostic failures", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-doctor-command-"))
  let broken = false
  let reachable = true
  let heads = 0
  const gateway = Bun.serve({
    port: 0,
    fetch(request) {
      if (request.method === "HEAD") heads++
      return new Response(null, { status: reachable ? 200 : 503 })
    },
  })
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/api/info") return Response.json({ version: "local" })
      if (url.pathname === "/api/config")
        return broken ? Response.json({ message: "Broken JSONC" }, { status: 400 }) : Response.json([])
      if (url.pathname === "/api/model/default") return Response.json({ data: null })
      if (url.pathname === "/api/integration")
        return broken
          ? Response.json({ message: "Auth storage unavailable" }, { status: 500 })
          : Response.json({
              data: [
                {
                  id: "fixture",
                  name: "Fixture",
                  connections: [{ type: "credential", id: "cred_fixture", label: "fixture", method: "key" }],
                },
              ],
            })
      return new Response(null, { status: 404 })
    },
  })
  const cli = async () => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "doctor",
        "--server",
        server.url.toString(),
      ],
      {
        cwd: home,
        env: isolatedEnv(home, {
          BOLT_MODELS_URL: gateway.url.toString(),
          FIXTURE_API_KEY: "fixture-secret-do-not-print",
        }),
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
    expect(stdout + stderr).not.toContain("fixture-secret-do-not-print")
    return { stdout, stderr, code }
  }
  try {
    const checked = await cli()
    // A development Bun process has no installed Bolt distribution; the binary diagnostic is expected to fail.
    expect(checked.code).toBe(1)
    expect(checked.stdout).toContain("binary: local via unknown")
    expect(checked.stdout).toContain("✓ config:")
    expect(checked.stdout).toContain("✓ credentials: 1 stored: fixture")
    expect(checked.stdout).toContain("FIXTURE_API_KEY")
    expect(checked.stdout).toContain("✓ gateway:")
    expect(checked.stdout).toContain("✓ data dir:")
    expect(checked.stdout).toContain("✓ cache dir:")
    expect(checked.stdout).toContain("✓ state dir:")
    expect(heads).toBe(1)
    broken = true
    reachable = false
    const failed = await cli()
    expect(failed.code).toBe(1)
    expect(failed.stdout).toContain("✗ config: Broken JSONC")
    expect(failed.stdout).toContain("✗ credentials: UnexpectedStatus: 500")
    expect(failed.stdout).toContain("unreachable")
    expect(failed.stdout).toContain("✓ state dir:")
    expect((await fs.readdir(path.join(home, "config"))).some((name) => name.startsWith(".doctor-"))).toBe(false)
  } finally {
    await server.stop(true)
    await gateway.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
})
