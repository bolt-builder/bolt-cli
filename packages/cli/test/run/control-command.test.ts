import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import { EOL } from "node:os"
import path from "node:path"
import type { SessionMessageInfo } from "@opencode/client/promise"
import { isolatedEnv } from "../fixture/environment"
import { OPENCODE_VERSION } from "../../src/version"

const entry = path.resolve(import.meta.dir, "../../src/index.ts")

async function fixture() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-run-controls-"))
  const streams = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const waiting = new Set<() => void>()
  const active = new Set<string>()
  const sessions = new Map<string, SessionMessageInfo[]>()
  const prompts: { sessionID: string; text: string }[] = []
  const selected: string[] = []
  const requests: string[] = []
  const state = { mode: "success", interruptions: 0, failStop: false }
  const tokens = { total: 20, input: 10, output: 5, reasoning: 2, cache: { read: 2, write: 1 } }
  const emit = (type: string, data: unknown) => {
    const bytes = new TextEncoder().encode(
      `data: ${JSON.stringify({ id: crypto.randomUUID(), created: 1, type, data })}\n\n`,
    )
    for (const controller of streams) {
      try {
        controller.enqueue(bytes)
      } catch {
        streams.delete(controller)
      }
    }
  }
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      requests.push(`${request.method} ${url.pathname}`)
      if (url.pathname === "/api/info") return Response.json({ version: OPENCODE_VERSION })
      if (url.pathname === "/api/location")
        return Response.json({ directory: home, project: { id: "project", directory: home } })
      if (url.pathname === "/api/config") return Response.json([{ type: "document", info: { default_agent: "build" } }])
      if (url.pathname === "/api/agent")
        return Response.json({
          data: [
            { id: "build", name: "Build", mode: "primary", hidden: false, description: "general coding" },
            {
              id: "security",
              name: "Security",
              mode: "primary",
              hidden: false,
              description: "review security vulnerabilities",
            },
            { id: "hidden", name: "Security review vulnerabilities", mode: "primary", hidden: true },
            { id: "child", name: "Security review vulnerabilities", mode: "subagent", hidden: false },
          ],
        })
      if (url.pathname === "/api/event") {
        let current: ReadableStreamDefaultController<Uint8Array>
        return new Response(
          new ReadableStream({
            start(controller) {
              current = controller
              streams.add(controller)
              controller.enqueue(new TextEncoder().encode('data: {"type":"server.connected","data":{}}\n\n'))
            },
            cancel() {
              streams.delete(current)
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        )
      }
      if (url.pathname === "/api/session" && request.method === "POST") {
        const body = await request.json()
        const id = `ses_controls_${sessions.size + 1}`
        sessions.set(id, [])
        if (body.agent) selected.push(body.agent)
        return Response.json({ data: { id, agent: body.agent, location: { directory: home } } })
      }
      const id = /^\/api\/(?:experimental\/)?session\/([^/]+)/.exec(url.pathname)?.[1]!
      if (url.pathname.endsWith("/agent")) return new Response(null, { status: 204 })
      if (url.pathname.endsWith("/permission") || url.pathname.endsWith("/form")) return Response.json({ data: [] })
      if (url.pathname.endsWith("/interrupt")) {
        state.interruptions++
        if (state.failStop) return new Response("stop failed", { status: 500 })
        active.delete(id)
        for (const resolve of waiting) resolve()
        waiting.clear()
        emit("session.execution.interrupted", { sessionID: id, reason: "user" })
        return Response.json({ interrupted: true })
      }
      if (url.pathname.endsWith("/wait")) {
        if (!active.has(id)) return new Response(null, { status: 204 })
        await new Promise<void>((resolve) => waiting.add(resolve))
        return new Response(null, { status: 204 })
      }
      if (url.pathname.endsWith("/prompt")) {
        const body = await request.json()
        const prior = prompts.filter((prompt) => prompt.sessionID === id).length
        prompts.push({ sessionID: id, text: body.text })
        const assistantMessageID = `msg_answer_${prompts.length}`
        const text =
          state.mode === "schema"
            ? prior
              ? '{"ok":true}'
              : "not JSON"
            : state.mode === "invalid-schema"
              ? "{}"
              : "answer\nwith\ttabs"
        const history = sessions.get(id)!
        history.push({ id: body.id, type: "user", text: body.text, time: { created: 1 } })
        emit("session.inbox.delivered", { sessionID: id, inboxID: body.id })
        if (state.mode === "partial" || (state.mode === "timeout-retry" && !prior)) {
          active.add(id)
          emit("session.text.started", { sessionID: id, assistantMessageID, ordinal: 0 })
          emit("session.text.delta", { sessionID: id, assistantMessageID, ordinal: 0, delta: "unfinished partial" })
          return Response.json({ data: { id: body.id } })
        }
        if (state.mode === "transient" && !prior) {
          emit("session.execution.failed", {
            sessionID: id,
            error: { type: "provider.transport", message: "temporary provider failure" },
          })
          return Response.json({ data: { id: body.id } })
        }
        history.push({
          id: assistantMessageID,
          type: "assistant",
          agent: "build",
          model: { providerID: "test", id: "model" },
          time: { created: 1, completed: 2 },
          finish: "stop",
          cost: 0.5,
          tokens,
          content: [{ type: "text", text }],
        })
        if (state.mode !== "projection") {
          emit("session.text.ended", { sessionID: id, assistantMessageID, ordinal: 0, text })
          emit("session.step.ended", { sessionID: id, assistantMessageID, finish: "stop", cost: 0.5, tokens })
        }
        emit("session.execution.succeeded", { sessionID: id })
        return Response.json({ data: { id: body.id } })
      }
      if (url.pathname.endsWith("/message")) return Response.json({ data: sessions.get(id)!.toReversed(), cursor: {} })
      return new Response(`Unexpected ${request.method} ${url.pathname}`, { status: 404 })
    },
  })
  const run = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "run",
        "--server",
        server.url.toString(),
        ...args,
      ],
      {
        cwd: home,
        env: isolatedEnv(home),
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
  return {
    home,
    state,
    prompts,
    selected,
    sessions,
    requests,
    run,
    async close() {
      for (const resolve of waiting) resolve()
      await server.stop(true)
      await fs.rm(home, { recursive: true, force: true })
    },
  }
}

test("run machine output preserves envelopes, TSV escaping, context and reconciled cost accounting", async () => {
  const f = await fixture()
  try {
    const json = await f.run("hello", "--json", "--cost-report")
    expect(json.code, json.stderr).toBe(0)
    expect(JSON.parse(json.stdout)).toEqual({
      version: 1,
      ok: true,
      result: { sessionID: "ses_controls_1", text: "answer\nwith\ttabs" },
    })
    expect(json.stderr).toContain("$0.5000")
    expect(json.stderr).toContain("1 step")
    const porcelain = await f.run("hello", "--porcelain")
    expect(porcelain.code, porcelain.stderr).toBe(0)
    expect(porcelain.stdout).toBe(`session\tses_controls_2${EOL}text\tanswer\\nwith\\ttabs${EOL}`)
    const context = await f.run("hello", "--emit", "context")
    expect(context.code, context.stderr).toBe(0)
    expect(context.stdout).toBe("[bolt run context session=ses_controls_3]\n\nanswer\nwith\ttabs\n")
    f.state.mode = "projection"
    const projected = await f.run("hello", "--format", "json", "--cost-report")
    expect(projected.code, projected.stderr).toBe(0)
    const events = projected.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
    expect(events.filter((event) => event.type === "text")).toHaveLength(1)
    expect(events.find((event) => event.type === "cost_report")).toMatchObject({
      cost: 0.5,
      steps: 1,
      tokens: { total: 20 },
    })
  } finally {
    await f.close()
  }
}, 30_000)

test("run retries provider errors and schema failures in the same session, validates flags and routes only selectable agents", async () => {
  const f = await fixture()
  try {
    f.state.mode = "transient"
    const retried = await f.run("hello", "--json", "--retries", "1")
    expect(retried.code, retried.stderr).toBe(0)
    expect(JSON.parse(retried.stdout).ok).toBe(true)
    expect(f.prompts.map((prompt) => prompt.sessionID)).toEqual(["ses_controls_1", "ses_controls_1"])
    const schema = path.join(f.home, "schema.json")
    await Bun.write(schema, JSON.stringify({ type: "object", required: ["ok"], properties: { ok: { const: true } } }))
    f.state.mode = "schema"
    const valid = await f.run("hello", "--json", "--output-schema", schema)
    expect(valid.code, valid.stderr).toBe(0)
    expect(JSON.parse(valid.stdout).result.text).toBe('{"ok":true}')
    expect(f.prompts.slice(2).map((prompt) => prompt.sessionID)).toEqual(["ses_controls_2", "ses_controls_2"])
    expect(f.prompts.at(-1)?.text).toContain("previous answer did not validate")
    f.state.mode = "invalid-schema"
    const invalid = await f.run("hello", "--json", "--output-schema", schema)
    expect(invalid.code).toBe(1)
    expect(JSON.parse(invalid.stdout)).toMatchObject({
      version: 1,
      ok: false,
      error: { message: expect.stringContaining("after 3 attempts") },
    })
    const before = f.sessions.size
    const flags = await f.run("hello", "--json", "--porcelain")
    expect(flags.code).toBe(1)
    expect(JSON.parse(flags.stdout).ok).toBe(false)
    expect(f.sessions.size).toBe(before)
    f.state.mode = "success"
    const routed = await f.run("review security vulnerabilities", "--json", "--auto-agent")
    expect(routed.code, routed.stderr).toBe(0)
    expect(f.selected.at(-1)).toBe("security")
    expect(routed.stderr).toContain("auto-agent: security")
  } finally {
    await f.close()
  }
}, 30_000)

test("run aborts on budgets and timeout, preserves partial text, and refuses retry if stopping fails", async () => {
  const f = await fixture()
  try {
    const budget = await f.run("hello", "--json", "--max-tokens", "20", "--retries", "2")
    expect(budget.code, budget.stderr).toBe(3)
    expect(JSON.parse(budget.stdout).error.message).toContain("token budget exceeded")
    expect(f.prompts).toHaveLength(1)
    expect(f.state.interruptions).toBe(1)
    f.state.mode = "partial"
    const timeout = await f.run("hello", "--format", "json", "--timeout", "0.5")
    expect(timeout.code, timeout.stderr).toBe(5)
    const events = timeout.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
    expect(events.find((event) => event.type === "timeout")).toMatchObject({
      attempt: 1,
      partial: "unfinished partial",
    })
    expect(f.state.interruptions).toBe(2)
    f.state.mode = "timeout-retry"
    const retried = await f.run("hello", "--json", "--timeout", "0.5", "--retries", "1")
    expect(retried.code, retried.stderr).toBe(0)
    expect(JSON.parse(retried.stdout).result.text).toBe("answer\nwith\ttabs")
    expect(f.prompts.slice(2).map((prompt) => prompt.sessionID)).toEqual(["ses_controls_3", "ses_controls_3"])
    f.state.mode = "partial"
    f.state.failStop = true
    const stopped = await f.run("hello", "--json", "--timeout", "0.5", "--retries", "2")
    expect(stopped.code).toBe(1)
    expect(JSON.parse(stopped.stdout).error.message).toContain("Could not stop")
    expect(f.prompts).toHaveLength(5)
  } finally {
    await f.close()
  }
}, 30_000)
