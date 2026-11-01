import { afterEach, beforeEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
let cwd: string
let server: ReturnType<typeof Bun.serve>
let missing: boolean
let failure: boolean
const requests: string[] = []
const user = {
  id: "msg_user",
  type: "user",
  time: { created: 1 },
  text: "billing user\nsecond line",
  files: [{ name: "fixture.txt", mime: "text/plain", data: "", source: { type: "uri", uri: "file:///fixture.txt" } }],
}
const assistant = {
  id: "msg_assistant",
  type: "assistant",
  time: { created: 2 },
  agent: "build",
  model: { providerID: "test", id: "model" },
  content: [
    { type: "reasoning", text: "billing reasoning" },
    { type: "text", text: "billing assistant" },
    {
      type: "tool",
      id: "tool_fixture",
      name: "bash",
      time: { created: 2 },
      state: {
        status: "completed",
        input: { command: "echo fixture" },
        content: [{ type: "text", text: "billing output" }],
        metadata: { title: "fixture title" },
      },
    },
  ],
}

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-transcript-"))
  requests.length = 0
  missing = false
  failure = false
  server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url)
      requests.push(url.pathname + url.search)
      if (url.pathname === "/api/info") return Response.json({ version: "local" })
      if (url.pathname === "/api/session")
        return Response.json({
          data: [{ id: url.searchParams.has("cursor") ? "ses_next" : "ses_fixture", title: "Fixture" }],
          cursor: url.searchParams.has("cursor") ? {} : { next: "sessions_next" },
        })
      if (url.pathname === "/api/session/ses_fixture/message") {
        if (missing)
          return Response.json(
            { _tag: "SessionNotFoundError", sessionID: "ses_fixture", message: "missing" },
            { status: 404 },
          )
        if (failure) return Response.json({ _tag: "InternalServerError", message: "fixture failure" }, { status: 500 })
        return Response.json({
          data: [url.searchParams.has("cursor") ? assistant : user],
          cursor: url.searchParams.has("cursor") ? {} : { next: "messages_next" },
        })
      }
      if (url.pathname === "/api/session/ses_next/message")
        return Response.json({ data: [{ ...user, id: "msg_next", text: "billing next session" }], cursor: {} })
      if (url.pathname === "/api/experimental/session/ses_fixture/export") {
        const sanitize = url.searchParams.get("sanitize") === "true"
        return Response.json({
          data: {
            info: { id: "ses_fixture", title: sanitize ? "[redacted]" : "Fixture <title>" },
            messages: sanitize ? [{ ...user, text: "[redacted]", files: [] }] : [user, assistant],
          },
        })
      }
      return new Response(`Unexpected: ${url.pathname}`, { status: 500 })
    },
  })
})

afterEach(async () => {
  await server.stop(true)
  await fs.rm(cwd, { recursive: true, force: true })
})

async function cli(...args: string[]) {
  const child = Bun.spawn(
    [process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, ...args, "--server", server.url.toString()],
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
  return { stdout, stderr, code }
}

test("grep traverses both session and message cursors, including reasoning and tool output", async () => {
  const result = await cli("grep", "BILLING", "-i", "--json")
  expect(result.code).toBe(0)
  const hits = JSON.parse(result.stdout)
  expect(hits.map((hit: { line: string }) => hit.line)).toEqual([
    "billing user",
    "billing reasoning",
    "billing assistant",
    "billing output",
    "billing next session",
  ])
  expect(hits.at(-1)).toMatchObject({ sessionID: "ses_next", messageID: "msg_next" })
  expect(requests.some((url) => url.includes("cursor=messages_next"))).toBe(true)
  expect(requests.some((url) => url.includes("cursor=sessions_next"))).toBe(true)
})

test("grep stops at the limit without fetching later pages", async () => {
  const result = await cli("grep", "billing", "--json", "--limit", "1")
  expect(result.code).toBe(0)
  expect(JSON.parse(result.stdout)).toHaveLength(1)
  expect(requests.some((url) => url.includes("cursor="))).toBe(false)
})

test("grep skips a removed session but propagates server failures", async () => {
  missing = true
  const result = await cli("grep", "billing", "--json")
  expect(result.code).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual([
    { sessionID: "ses_next", title: "Fixture", messageID: "msg_next", line: "billing next session" },
  ])
  missing = false
  failure = true
  expect((await cli("grep", "billing")).code).toBe(1)
})

test("grep rejects invalid inputs before contacting the server and returns 1 for no matches", async () => {
  expect((await cli("grep", "(")).stderr).toContain("Invalid pattern")
  expect((await cli("grep", "billing", "--limit", "0")).stderr).toContain("positive integer")
  expect(requests).toHaveLength(0)
  expect(await cli("grep", "no-match")).toEqual({ code: 1, stdout: "", stderr: "" })
})

test("export Markdown uses the original renderer with V2 tools and attachments", async () => {
  const result = await cli("export", "ses_fixture", "--md")
  expect(result.code).toBe(0)
  expect(result.stdout).toContain("# Fixture <title>")
  expect(result.stdout).toContain("attached `fixture.txt`")
  expect(result.stdout).toContain("Assistant (build · test/model)")
  expect(result.stdout).toContain("`bash` fixture title")
  expect(result.stdout).not.toContain("billing reasoning")
})

test("HTML replay honors sanitization and escapes transcript content", async () => {
  const out = path.join(cwd, "replay.html")
  const result = await cli("session", "export", "ses_fixture", "--html", "--out", out)
  expect(result.code).toBe(0)
  expect(await fs.readFile(out, "utf8")).toContain("Fixture &lt;title&gt;")
  expect((await cli("export", "ses_fixture", "--html", "--sanitize", "--out", out)).code).toBe(0)
  const sanitized = await fs.readFile(out, "utf8")
  expect(sanitized).toContain("[redacted]")
  expect(sanitized).not.toContain("billing")
  expect(sanitized).not.toContain("fixture.txt")
})

test("export JSON, JSONL and porcelain preserve their format contracts", async () => {
  const json = await cli("export", "ses_fixture", "--json")
  expect(json.code).toBe(0)
  expect(JSON.parse(json.stdout)).toMatchObject({
    version: 1,
    ok: true,
    result: { info: { id: "ses_fixture" }, messages: [{ type: "user" }, { type: "assistant" }] },
  })
  const jsonl = await cli("export", "ses_fixture", "--jsonl")
  expect(jsonl.code).toBe(0)
  expect(
    jsonl.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line).type),
  ).toEqual(["user", "assistant"])
  const tsv = await cli("export", "ses_fixture", "--porcelain")
  expect(tsv.code).toBe(0)
  expect(tsv.stdout).toContain("message\tmsg_user\tuser\tbilling user\\nsecond line\n")
  expect((await cli("export", "ses_fixture", "--html", "--md")).code).toBe(1)
})
