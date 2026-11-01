import { afterEach, beforeEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const entry = path.resolve(import.meta.dir, "../src/index.ts")
let cwd: string
let response: string
let command: "review" | "why"
const prompts: { text: string }[] = []
const removed: string[] = []
let events: ReadableStreamDefaultController<Uint8Array> | undefined
let server: ReturnType<typeof Bun.serve>

async function git(...args: string[]) {
  const child = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  expect({ code, stderr }).toEqual({ code: 0, stderr: "" })
  return stdout.trim()
}

async function cli(args: string[], stdin = "") {
  const child = Bun.spawn(
    [
      process.execPath,
      "run",
      "--jsx-import-source=@opentui/solid",
      entry,
      command,
      ...args,
      "--server",
      server.url.toString(),
    ],
    {
      cwd,
      env: { ...process.env, XDG_STATE_HOME: path.join(cwd, "state") },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  child.stdin.write(stdin)
  child.stdin.end()
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { stdout, stderr, code }
}

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-review-"))
  command = "review"
  response = "No issues.\nConfidence: high\nVerdict: PASS"
  prompts.length = 0
  removed.length = 0
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/api/info") return Response.json({ version: "local" })
      if (url.pathname === "/api/session" && request.method === "POST") {
        expect(await request.json()).toMatchObject({ agent: command === "why" ? "ask" : "code-review" })
        return Response.json({ data: { id: "ses_fixture" } })
      }
      if (url.pathname === "/api/event")
        return new Response(
          new ReadableStream({
            start(controller) {
              events = controller
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ id: "connected", created: 1, type: "server.connected", data: {} })}\n\n`,
                ),
              )
            },
            cancel() {
              events = undefined
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        )
      if (url.pathname === "/api/session/ses_fixture/prompt") {
        prompts.push(await request.json())
        events?.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ id: crypto.randomUUID(), created: 1, type: "session.execution.succeeded", data: { sessionID: "ses_fixture" } })}\n\n`,
          ),
        )
        return Response.json({ data: { id: "inbox_fixture" } })
      }
      if (url.pathname === "/api/session/ses_fixture/message")
        return Response.json({
          data: [{ id: "msg_fixture", type: "assistant", content: [{ type: "text", text: response }] }],
          cursor: {},
        })
      if (url.pathname === "/api/session/ses_fixture" && request.method === "DELETE") {
        removed.push("ses_fixture")
        return new Response(null, { status: 204 })
      }
      return new Response(`Unexpected: ${request.method} ${url.pathname}`, { status: 500 })
    },
  })
})

afterEach(async () => {
  await server.stop(true)
  await fs.rm(cwd, { recursive: true, force: true })
})

test.each([
  { text: "Verdict: PASS", code: 0 },
  { text: "Verdict: FAIL", code: 1 },
  { text: "No verdict", code: 2 },
])("piped review reports $code for $text and removes its session", async ({ text, code }) => {
  response = text
  const result = await cli([], "fixture diff")
  expect(result.code).toBe(code)
  expect(result.stdout).toBe(text + "\n")
  expect(prompts[0]?.text).toEndWith("Diff:\nfixture diff")
  expect(removed).toEqual(["ses_fixture"])
})

test("JSON preserves the V1 envelope and confidence", async () => {
  const result = await cli(["--json", "--confidence"], "fixture diff")
  expect(result.code).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({
    version: 1,
    ok: true,
    result: { verdict: "pass", confidence: "high", text: response },
  })
  expect(result.stderr).toBe("")
  expect(prompts[0]?.text).toContain('"Confidence: high"')
})

test("porcelain escapes multiline output into a single TSV record", async () => {
  const result = await cli(["--porcelain", "--confidence"], "fixture diff")
  expect(result.code).toBe(0)
  expect(result.stdout).toBe("verdict\tpass\nconfidence\thigh\ntext\tNo issues.\\nConfidence: high\\nVerdict: PASS\n")
})

test("rejects conflicting flags and oversized diffs before creating a session", async () => {
  const conflict = await cli(["--json", "--porcelain"], "fixture diff")
  expect(conflict.code).toBe(1)
  expect(JSON.parse(conflict.stdout)).toMatchObject({ version: 1, ok: false, error: { name: "Error" } })
  expect((await cli(["--staged"], "fixture diff")).stderr).toContain("--staged cannot be used")
  expect((await cli(["--branch=main"], "fixture diff")).stderr).toContain("--branch cannot be used")
  expect((await cli([], "x".repeat(120_001))).stderr).toContain("too large")
  expect(prompts).toHaveLength(0)
})

async function repository() {
  await git("init", "--quiet", "-b", "main")
  await git("config", "user.email", "fixture@example.invalid")
  await git("config", "user.name", "Fixture")
  await fs.writeFile(path.join(cwd, "fixture.ts"), "export const before = 1\n")
  await git("add", "fixture.ts")
  await git("commit", "--quiet", "-m", "fixture")
}

test("reviews staged Git changes and avoids the server for an empty diff", async () => {
  await repository()
  expect(await cli(["--json"])).toEqual({
    stdout: '{"version":1,"ok":true,"result":{"verdict":null,"confidence":null,"text":""}}\n',
    stderr: "",
    code: 0,
  })
  expect(prompts).toHaveLength(0)
  await fs.writeFile(path.join(cwd, "fixture.ts"), "export const staged = 2\n")
  await git("add", "fixture.ts")
  await fs.writeFile(path.join(cwd, "fixture.ts"), "export const unstaged = 3\n")
  expect((await cli(["--staged"])).code).toBe(0)
  expect(prompts[0]?.text).toContain("+export const staged = 2")
  expect(prompts[0]?.text).not.toContain("+export const unstaged = 3")
})

test("branch review discovers the default branch and excludes uncommitted changes", async () => {
  await repository()
  await git("checkout", "--quiet", "-b", "feature")
  await fs.writeFile(path.join(cwd, "fixture.ts"), "export const committed = 2\n")
  await git("commit", "--quiet", "-am", "feature")
  await fs.writeFile(path.join(cwd, "fixture.ts"), "export const unstaged = 3\n")
  const result = await cli(["--branch", "--porcelain"])
  expect(result.code).toBe(0)
  expect(result.stderr).toContain("Signatures: 0 signed, 1 unsigned")
  expect(prompts[0]?.text).toContain("+export const committed = 2")
  expect(prompts[0]?.text).not.toContain("+export const unstaged = 3")
  const explicit = await cli(["--branch", "main", "--json"])
  expect(explicit.code).toBe(0)
  expect(JSON.parse(explicit.stdout).result.verdict).toBe("pass")
  expect((await cli(["main"])).stderr).toContain("Unexpected argument: main")
})

test("why gathers real Git evidence and requires the answer to cite a commit", async () => {
  command = "why"
  await repository()
  const sha = await git("rev-parse", "HEAD")
  response = `Introduced in ${sha.slice(0, 7)} by Fixture.`
  const result = await cli(["when was it added?", "--file", "fixture.ts"])
  expect(result.code).toBe(0)
  expect(result.stdout).toBe(response + "\n")
  expect(result.stderr).toContain(`Cited commits: ${sha.slice(0, 7)}`)
  expect(prompts[0]?.text).toContain("Question: when was it added?")
  expect(prompts[0]?.text).toContain("+export const before = 1")
  expect(removed).toEqual(["ses_fixture"])
  response = "I am guessing."
  const uncited = await cli(["why?", "--term", "before"])
  expect(uncited.code).toBe(1)
  expect(uncited.stderr).toContain("cites none of the commits")
})

test("why validates scope and line ranges before admitting model work", async () => {
  command = "why"
  expect((await cli(["why?"])).stderr).toContain("Point the dig somewhere")
  expect((await cli(["why?", "--term", "before", "--lines", "1"])).stderr).toContain("--lines requires --file")
  await repository()
  expect((await cli(["why?", "--file", "fixture.ts", "--lines", "2,1"])).stderr).toContain("Could not parse --lines")
  const none = await cli(["why?", "--term", "missing_fixture_string"])
  expect(none.code).toBe(0)
  expect(none.stdout).toContain("No commits found")
  expect(prompts).toHaveLength(0)
})
