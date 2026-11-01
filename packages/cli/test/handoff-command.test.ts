import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
test("push and pull use authenticated V2 transfers, rebind locations and report collisions and failures", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-handoff-command-"))
  const localSessions = new Map<string, { info: { id: string; title: string }; messages: unknown[] }>([
    [
      "ses_outgoing",
      {
        info: { id: "ses_outgoing", title: "Keep this history" },
        messages: [{ id: "msg_original", type: "user", text: "retained" }],
      },
    ],
  ])
  const remoteSessions = new Map<string, { info: { id: string; title: string }; messages: unknown[] }>([
    ["ses_incoming", { info: { id: "ses_incoming", title: "Remote history" }, messages: [] }],
  ])
  const imports: { side: string; body: { location: { directory: string }; info: { id: string } } }[] = []
  const locations: { side: string; directory: string | null }[] = []
  const passwords = { local: "local-fixture-secret", remote: "remote-fixture-secret" }
  const server = (side: "local" | "remote", sessions: typeof localSessions) =>
    Bun.serve({
      port: 0,
      async fetch(request) {
        const url = new URL(request.url)
        if (
          request.headers.get("authorization") !==
          `Basic ${Buffer.from(`opencode:${passwords[side]}`).toString("base64")}`
        )
          return Response.json({ message: "Unauthorized" }, { status: 401 })
        if (url.pathname === "/api/info") return Response.json({ version: "local" })
        if (url.pathname === "/api/location") {
          locations.push({ side, directory: url.searchParams.get("location[directory]") })
          return Response.json({ directory: url.searchParams.get("location[directory]") ?? `/fixture/${side}` })
        }
        if (url.pathname === "/api/experimental/session/import") {
          const body = await request.json()
          if (!body.info?.id || !Array.isArray(body.messages))
            return Response.json({ message: "Invalid transfer" }, { status: 400 })
          if (sessions.has(body.info.id)) return Response.json({ message: "Session already exists" }, { status: 409 })
          imports.push({ side, body })
          sessions.set(body.info.id, body)
          return Response.json({ data: body.info })
        }
        const id = /^\/api\/experimental\/session\/([^/]+)\/export$/.exec(url.pathname)?.[1]
        if (id === "ses_malformed")
          return new Response("invalid JSON", { headers: { "content-type": "application/json" } })
        if (id)
          return sessions.has(id)
            ? Response.json({ data: sessions.get(id) })
            : Response.json({ message: "Session not found" }, { status: 404 })
        return new Response(null, { status: 404 })
      },
    })
  const local = server("local", localSessions)
  const remote = server("remote", remoteSessions)
  const cli = async (command: string, id: string, ...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        command,
        id,
        remote.url.toString(),
        "--server",
        local.url.toString(),
        ...args,
      ],
      {
        cwd: home,
        env: isolatedEnv(home, { OPENCODE_PASSWORD: passwords.local, BOLT_SERVER_PASSWORD: passwords.remote }),
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
    expect(stdout + stderr).not.toContain(passwords.local)
    expect(stdout + stderr).not.toContain(passwords.remote)
    return { stdout, stderr, code }
  }
  try {
    const push = await cli("push", "ses_outgoing", "--dir", "/fixture/destination")
    expect(push.code, push.stderr).toBe(0)
    expect(push.stdout).toContain("Pushed session ses_outgoing")
    expect(imports[0]).toMatchObject({
      side: "remote",
      body: { location: { directory: "/fixture/destination" }, messages: [{ id: "msg_original", text: "retained" }] },
    })
    const collision = await cli("push", "ses_outgoing")
    expect(collision.code).toBe(1)
    expect(collision.stderr).toContain("Session already exists")
    expect(imports).toHaveLength(1)
    const pull = await cli(
      "pull",
      "ses_incoming",
      "--password",
      passwords.remote,
      "--username",
      "opencode",
      "--dir",
      "/fixture/remote-project",
    )
    expect(pull.code, pull.stderr).toBe(0)
    expect(pull.stdout).toContain("Pulled session ses_incoming")
    expect(imports[1]).toMatchObject({
      side: "local",
      body: { location: { directory: home }, info: { id: "ses_incoming" } },
    })
    expect(locations).toContainEqual({ side: "remote", directory: "/fixture/remote-project" })
    const missing = await cli("pull", "ses_missing")
    expect(missing.code).toBe(1)
    expect(missing.stderr).toContain("Session not found")
    const malformed = await cli("pull", "ses_malformed")
    expect(malformed.code).toBe(1)
    const denied = await cli("push", "ses_outgoing", "--password", "wrong-fixture-secret")
    expect(denied.code).toBe(1)
    expect(denied.stderr).toContain("Unauthorized")
    expect(imports).toHaveLength(2)
    expect(localSessions.get("ses_outgoing")?.messages[0]).toMatchObject({ id: "msg_original", text: "retained" })
  } finally {
    await local.stop(true)
    await remote.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
})
