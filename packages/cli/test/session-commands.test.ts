import { afterEach, beforeEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

let root: string
let server: ReturnType<typeof Bun.serve>
let fail: boolean
const forks: unknown[] = []
const requests: string[] = []
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-session-command-"))
  forks.length = 0
  requests.length = 0
  fail = false
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      requests.push(url.pathname + url.search)
      if (url.pathname === "/api/info") return Response.json({ version: "local" })
      if (url.pathname === "/api/session/ses_fixture/message") {
        if (fail)
          return Response.json(
            { _tag: "SessionNotFoundError", sessionID: "ses_fixture", message: "missing" },
            { status: 404 },
          )
        const page = url.searchParams.has("cursor")
        if (page && url.searchParams.has("order"))
          return Response.json(
            { _tag: "InvalidCursorError", message: "Cursor cannot be combined with order" },
            { status: 400 },
          )
        return Response.json({
          data: (page ? ["msg_c"] : ["msg_a", "msg_b"]).map((id) => ({ id, type: "user", text: "fixture" })),
          cursor: page ? {} : { next: "page2" },
        })
      }
      if (url.pathname === "/api/session/ses_fixture/fork") {
        forks.push(await request.json())
        return Response.json({ data: { id: "ses_fork", title: "Fork fixture" } })
      }
      return new Response("fixture route not found", { status: 404 })
    },
  })
})
afterEach(async () => {
  server.stop(true)
  await fs.rm(root, { recursive: true, force: true })
})
const cli = async (...args: string[]) => {
  const child = Bun.spawn(
    [
      process.execPath,
      "run",
      "--jsx-import-source=@opentui/solid",
      path.resolve(import.meta.dir, "../src/index.ts"),
      ...args,
      "--server",
      server.url.href,
    ],
    { cwd: root, env: isolatedEnv(root), stdout: "pipe", stderr: "pipe", stdin: "ignore" },
  )
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { stdout, stderr, code }
}

test.each([
  ["msg_a", "msg_b"],
  ["msg_b", "msg_c"],
  ["msg_c", undefined],
] as const)("fork includes anchor %s and passes the next message as exclusive V2 boundary", async (anchor, before) => {
  const result = await cli("fork", "ses_fixture", anchor)
  expect(result.code).toBe(0)
  expect(forks).toEqual([before ? { before } : {}])
  expect(result.stdout).toContain("Forked into ses_fork Fork fixture")
  expect(result.stdout).toContain('bolt run --session ses_fork "<prompt>"')
  expect(requests.some((url) => url.includes("cursor=page2"))).toBe(anchor !== "msg_a")
})

test("full-history fork needs no message fetch, and missing anchors never create a child", async () => {
  expect((await cli("fork", "ses_fixture")).code).toBe(0)
  expect(forks).toEqual([{}])
  expect(requests.some((url) => url.includes("/message"))).toBe(false)
  forks.length = 0
  const missing = await cli("fork", "ses_fixture", "msg_absent")
  expect(missing.code).toBe(1)
  expect(missing.stderr).toContain("Message not found in session: msg_absent")
  expect(forks).toEqual([])
})

test("missing parent errors propagate without mutation", async () => {
  fail = true
  expect((await cli("fork", "ses_fixture", "msg_a")).code).toBe(1)
  expect(forks).toEqual([])
})

test("interactive resume preflight prevents reads and fork mutations without a terminal", async () => {
  expect((await cli("resume", "ses_fixture")).code).toBe(1)
  expect((await cli("fork", "ses_fixture", "--resume")).code).toBe(1)
  expect(forks).toEqual([])
  expect(requests).toEqual([])
})
