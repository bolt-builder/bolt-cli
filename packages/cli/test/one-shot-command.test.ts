import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const entry = path.resolve(import.meta.dir, "../src/index.ts")

test("ask and commit use disposable V2 sessions, preserve stdout and honor dry run", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-one-shot-"))
  const created: { title?: string; agent: string; model?: { id: string }; permissions: unknown[] }[] = []
  const prompts: { text: string }[] = []
  const removed: string[] = []
  const replies: unknown[] = []
  const cancelled: string[] = []
  let invariantAnswer = "- Returns the same value\n"
  let detected = 2
  let review = "- major: fixture defect\nVerdict: FAIL"
  let events: ReadableStreamDefaultController<Uint8Array> | undefined
  const encode = new TextEncoder()
  const emit = (type: string, data: unknown) =>
    events?.enqueue(encode.encode(`data: ${JSON.stringify({ id: crypto.randomUUID(), created: 1, type, data })}\n\n`))
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      const sessionID = `ses_${created.length}`
      const current = created.at(-1)
      if (url.pathname === "/api/rpc/bolt.memory/manage")
        return Response.json({ output: { root: "/server/memory", text: "Auto-learned fixture", count: detected } })
      if (url.pathname === "/api/info") return Response.json({ version: "local" })
      if (url.pathname === "/api/session" && request.method === "POST") {
        created.push(await request.json())
        return Response.json({ data: { id: `ses_${created.length}` } })
      }
      if (url.pathname === "/api/event")
        return new Response(
          new ReadableStream({
            start(controller) {
              events = controller
              emit("server.connected", {})
            },
            cancel() {
              events = undefined
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        )
      if (url.pathname === `/api/session/${sessionID}/prompt`) {
        prompts.push(await request.json())
        if (current?.model?.id === "fail")
          emit("session.execution.failed", { sessionID, error: { message: "Provider fixture failed" } })
        else if (current?.agent === "ask")
          emit("permission.asked", { sessionID, id: "per_fixture", action: "read", resources: [".env"] })
        else {
          if (current?.agent === "build" && current.model?.id !== "no-save") {
            emit("session.tool.input.started", {
              sessionID,
              id: "save_fixture",
              name: "memory_save",
              assistantMessageID: "msg_tools",
            })
            emit("session.tool.success", {
              sessionID,
              id: "save_fixture",
              assistantMessageID: "msg_tools",
              metadata: { sources: ["project.md"] },
              executed: true,
              content: [{ type: "text", text: "Saved" }],
            })
          }
          emit("session.execution.succeeded", { sessionID })
        }
        return Response.json({ data: { id: "inbox_fixture" } })
      }
      if (url.pathname.endsWith("/permission/per_fixture/reply")) {
        replies.push(await request.json())
        emit("form.created", { form: { id: "form_fixture", sessionID } })
        return new Response(null, { status: 204 })
      }
      if (url.pathname.endsWith("/form/form_fixture") && request.method === "DELETE") {
        cancelled.push(sessionID)
        emit("session.execution.succeeded", { sessionID })
        return new Response(null, { status: 204 })
      }
      if (url.pathname === `/api/session/${sessionID}/message`)
        return Response.json({
          data: [
            {
              id: "msg_answer",
              type: "assistant",
              content: [
                {
                  type: "text",
                  text: current?.title?.startsWith("bolt invariants:")
                    ? invariantAnswer
                    : current?.agent === "code-review"
                      ? review
                      : current?.agent === "build"
                        ? "Learned fixture conventions"
                        : current?.agent === "ask"
                          ? "Fixture answer"
                          : "<think>private reasoning</think>\n```text\nfeat: fixture commit\n```",
                },
              ],
            },
          ],
          cursor: {},
        })
      if (url.pathname === `/api/session/${sessionID}` && request.method === "DELETE") {
        removed.push(sessionID)
        return new Response(null, { status: 204 })
      }
      return new Response(`Unexpected request: ${request.method} ${url.pathname}`, { status: 500 })
    },
  })
  const cli = async (args: string[], stdin = "") => {
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
  const git = async (...args: string[]) => {
    const child = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" })
    return stdout
  }
  try {
    expect(await cli(["ask", "why", "did", "it", "fail", "--model", "test/model"], "TypeError fixture\n")).toEqual({
      stdout: "Fixture answer\n",
      stderr: "",
      code: 0,
    })
    expect(prompts[0]?.text).toBe("why did it fail\n\nContext:\nTypeError fixture")
    expect(created[0]).toMatchObject({
      agent: "ask",
      model: { id: "model", providerID: "test" },
      permissions: [{ action: "question", resource: "*", effect: "deny" }],
    })
    expect(replies).toEqual([
      { decision: "reject", message: "This one-shot command cannot request permission. Continue without this action." },
    ])
    expect(cancelled).toEqual(["ses_1"])
    expect(removed).toEqual(["ses_1"])
    const failed = await cli(["ask", "question", "--model", "test/fail"])
    expect(failed).toEqual({ code: 1, stderr: "Provider fixture failed\n", stdout: "" })
    expect(removed).toEqual(["ses_1", "ses_2"])
    const emptyModel = await cli(["ask", "question", "--model", ""])
    expect(emptyModel.code).toBe(1)
    const invalid = await cli(["ask", "question", "--model", "invalid"])
    expect(invalid.code).toBe(1)
    expect(created).toHaveLength(2)
    await git("init", "-q", "-b", "main")
    await git("config", "user.name", "Fixture")
    await git("config", "user.email", "fixture@example.invalid")
    await Bun.write(path.join(cwd, "tracked.txt"), "before\n")
    await git("add", "tracked.txt")
    await git("commit", "-qm", "initial")
    const head = await git("rev-parse", "HEAD")
    await Bun.write(path.join(cwd, "tracked.txt"), "after\n")
    await git("add", "tracked.txt")
    const dry = await cli(["commit", "--dry-run"])
    expect(dry).toEqual({ code: 0, stderr: "Generating commit message...\n", stdout: "feat: fixture commit\n" })
    expect(await git("rev-parse", "HEAD")).toBe(head)
    expect(prompts.at(-1)?.text).toContain("+after")
    expect(prompts.at(-1)?.text).toContain("initial")
    expect(removed).toHaveLength(3)
    const committed = await cli(["commit"])
    expect({ code: committed.code, stderr: committed.stderr }).toEqual({
      code: 0,
      stderr: "Generating commit message...\n",
    })
    expect(await git("log", "-1", "--format=%s")).toBe("feat: fixture commit\n")
    expect(await git("show", "HEAD:tracked.txt")).toBe("after\n")
    expect(removed).toHaveLength(4)
    const gate = await cli(["diff-gate"], "diff --git a/file.ts b/file.ts\n-old\n+new")
    expect(gate.code).toBe(1)
    expect(gate.stdout).toContain("major: fixture defect")
    expect(gate.stderr).toContain("1 defect at or above major")
    expect(prompts.at(-1)?.text).toContain("Diff:\ndiff --git")
    expect((await cli(["diff-gate", "--threshold", "critical"], "fixture diff")).code).toBe(0)
    review = "No issues. Verdict: PASS"
    expect((await cli(["diff-gate"], "fixture diff")).code).toBe(0)
    review = "Verdict: FAIL"
    expect((await cli(["diff-gate"], "fixture diff")).code).toBe(1)
    review = "No verdict provided"
    expect((await cli(["diff-gate"], "fixture diff")).code).toBe(2)
    const beforeEmpty = created.length
    expect((await cli(["diff-gate"], "")).code).toBe(1)
    expect(created).toHaveLength(beforeEmpty)
    const learned = await cli(["learn", "--model", "test/model"])
    expect(learned.code).toBe(0)
    expect(learned.stdout).toBe("Learned fixture conventions\n")
    expect(learned.stderr).toContain("Saved 1 convention entry (project.md)")
    expect(prompts.at(-1)?.text).toContain('action "remember"')
    expect(created.at(-1)?.agent).toBe("build")
    expect(removed.at(-1)).toBe(`ses_${created.length}`)
    const deterministic = await cli(["learn", "--model", "test/no-save"])
    expect(deterministic.code).toBe(0)
    expect(deterministic.stderr).toContain("2 auto-learned commands persisted")
    detected = 0
    const empty = await cli(["learn", "--model", "test/no-save"])
    expect(empty.code).toBe(1)
    expect(empty.stderr).toContain("without saving any conventions")
    await Bun.write(path.join(cwd, "weak.test.ts"), 'test("empty", () => {})\n')
    await Bun.write(path.join(cwd, "loose.ts"), "const value: any = 1\n")
    for (const [command, file] of [
      ["asserts", "weak.test.ts"],
      ["tighten", "loose.ts"],
    ]) {
      const suggested = await cli([command, file, "--suggest", "--model", "test/model"])
      expect(suggested.code).toBe(1)
      expect(suggested.stdout).toContain("Fixture answer")
      expect(prompts.at(-1)?.text).toContain("Do NOT edit any files")
      expect(prompts.at(-1)?.text).toContain(file)
      expect(created.at(-1)).toMatchObject({ agent: "ask", model: { id: "model", providerID: "test" } })
      expect(removed.at(-1)).toBe(`ses_${created.length}`)
    }
    await Bun.write(path.join(cwd, "refactor.ts"), "export const value = 1\n")
    expect((await cli(["invariants", "state", "refactor.ts"])).code).toBe(0)
    const invariantFile = path.join(cwd, ".bolt/invariants.md")
    expect(await Bun.file(invariantFile).text()).toContain("Files: refactor.ts\n\n- Returns the same value")
    expect(prompts.at(-1)?.text).toContain("export const value = 1")
    for (const [response, code] of [
      ["HOLDS: Returns the same value\nVerdict: PASS", 0],
      ["VIOLATED: Returns the same value\nVerdict: FAIL", 1],
      ["Uncertain", 2],
    ] as const) {
      invariantAnswer = response
      expect((await cli(["invariants", "verify"])).code).toBe(code)
      expect(prompts.at(-1)?.text).toContain("Returns the same value")
      expect(removed.at(-1)).toBe(`ses_${created.length}`)
    }
    const savedInvariants = await Bun.file(invariantFile).text()
    invariantAnswer = "No invariant bullets"
    expect((await cli(["invariants", "state", "refactor.ts"])).code).toBe(1)
    expect(await Bun.file(invariantFile).text()).toBe(savedInvariants)
  } finally {
    await server.stop(true)
    await fs.rm(cwd, { recursive: true, force: true })
  }
}, 60000)
