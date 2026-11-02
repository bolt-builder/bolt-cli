import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

const entry = path.resolve(import.meta.dir, "../src/index.ts")

test("batch and playbook execution retain sessions, preserve step context, summarize failures and stop at a failed step", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-workflows-"))
  const streams = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const sessions = new Map<string, { prompts: string[]; answer: string }>()
  const removed: string[] = []
  let serial = 0
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/api/info") return Response.json({ version: "local" })
      if (url.pathname === "/api/event")
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streams.add(controller)
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify({ type: "server.connected", data: {} })}\n\n`),
              )
            },
            cancel() {},
          }),
          { headers: { "content-type": "text/event-stream" } },
        )
      if (url.pathname === "/api/session" && request.method === "POST") {
        const input = await request.json()
        expect(input.permissions).toEqual(
          expect.arrayContaining([{ action: "question", resource: "*", effect: "deny" }]),
        )
        const id = `ses_workflow_${++serial}`
        sessions.set(id, { prompts: [], answer: "" })
        return Response.json({ data: { id } })
      }
      const id = /^\/api\/session\/([^/]+)/.exec(url.pathname)?.[1]!
      const session = sessions.get(id)
      if (url.pathname === `/api/session/${id}` && request.method === "GET") return Response.json({ data: { id } })
      if (url.pathname === `/api/session/${id}` && request.method === "DELETE") {
        removed.push(id)
        return new Response(null, { status: 204 })
      }
      if (url.pathname === `/api/session/${id}/prompt`) {
        const input = await request.json()
        session!.prompts.push(input.text)
        const failed = input.text.includes("Fail this step") || input.text === "bad prompt"
        session!.answer = input.text.startsWith("You are executing step")
          ? `Work complete\nStep: ${failed ? "FAILED" : "DONE"}`
          : failed
            ? ""
            : `Answered ${input.text}`
        for (const controller of streams) {
          try {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: "session.execution.succeeded", data: { sessionID: id } })}\n\n`,
              ),
            )
          } catch {
            streams.delete(controller)
          }
        }
        return Response.json({ data: { id: `msg_${serial}` } })
      }
      if (url.pathname === `/api/session/${id}/message`)
        return Response.json({
          data: [{ id: "msg_answer", type: "assistant", content: [{ type: "text", text: session!.answer }] }],
          cursor: {},
        })
      if (url.pathname.endsWith("/interrupt")) return new Response(null, { status: 204 })
      return new Response("Unexpected fixture request", { status: 404 })
    },
  })
  const cli = async (...args: string[]) => {
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
    await Bun.write(path.join(home, "batch.txt"), "# ignored\nfirst prompt\nbad prompt\nthird prompt\n")
    const batch = await cli("batch", "batch.txt", "--parallel", "2")
    expect(batch.code, batch.stderr).toBe(1)
    expect(batch.stdout).toContain("2/3 succeeded")
    expect(sessions.size).toBe(3)
    expect([...sessions.values()].every((session) => session.prompts.length === 1)).toBe(true)
    expect(removed).toEqual([])
    sessions.clear()
    await Bun.write(
      path.join(home, "playbook.md"),
      "## First step\nRead the config.\n## Second step\nUpdate the docs.\n",
    )
    const playbook = await cli("exec", "--file", "playbook.md")
    expect(playbook.code, playbook.stderr).toBe(0)
    expect(playbook.stdout).toContain("Completed 2 steps")
    expect(sessions.size).toBe(1)
    expect([...sessions.values()][0].prompts).toHaveLength(2)
    sessions.clear()
    await Bun.write(path.join(home, "playbook.md"), "## First step\nFail this step\n## Second step\nMust not run\n")
    const failed = await cli("exec", "-f", "playbook.md")
    expect(failed.code).toBe(1)
    expect([...sessions.values()][0].prompts).toHaveLength(1)
    expect(removed).toEqual([])
  } finally {
    server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 30_000)

test("undo traverses message pages without mixing cursor and order, stacks boundaries and restores pending undo", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-undo-"))
  let marker: string | undefined
  const stages: { messageID: string; files: boolean }[] = []
  const messages = Array.from({ length: 150 }, (_, index) => ({
    id: `msg_${String(index).padStart(4, "0")}`,
    type: index % 2 ? "assistant" : "user",
    content: [],
  }))
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/api/info") return Response.json({ version: "local" })
      if (url.pathname === "/api/location")
        return Response.json({
          directory: home,
          project: { id: "prj_undo", directory: home, canonical: home },
        })
      const session = { id: "ses_undo", title: "Undo fixture", revert: marker ? { messageID: marker } : undefined }
      if (url.pathname === "/api/session") {
        expect(url.searchParams.get("project")).toBe("prj_undo")
        return Response.json({ data: [session], cursor: {} })
      }
      if (url.pathname === "/api/session/ses_undo") return Response.json({ data: session })
      if (url.pathname === "/api/session/ses_undo/message") {
        const next = url.searchParams.get("cursor")
        expect(url.searchParams.get("order")).toBe(next ? null : "asc")
        return Response.json({
          data: next ? messages.slice(100) : messages.slice(0, 100),
          cursor: next ? {} : { next: "next_page" },
        })
      }
      if (url.pathname === "/api/session/ses_undo/revert/stage") {
        const input = await request.json()
        stages.push(input)
        marker = input.messageID
        return Response.json({
          data: {
            messageID: marker,
            files: [{ file: "file.ts", status: "modified", additions: 1, deletions: 2, patch: "fixture" }],
          },
        })
      }
      if (url.pathname === "/api/session/ses_undo/revert" && request.method === "DELETE") {
        marker = undefined
        return new Response(null, { status: 204 })
      }
      return new Response("Unexpected fixture request", { status: 404 })
    },
  })
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        entry,
        "undo",
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
    const first = await cli()
    expect(first.code, first.stderr).toBe(0)
    expect(first.stdout).toContain("1 file rolled back (+1/-2)")
    expect(stages).toEqual([{ messageID: "msg_0148", files: true }])
    const second = await cli("--session", "ses_undo")
    expect(second.code, second.stderr).toBe(0)
    expect(stages[1]).toEqual({ messageID: "msg_0146", files: true })
    expect((await cli("-s", "ses_undo", "--redo")).code).toBe(0)
    expect(marker).toBeUndefined()
    const empty = await cli("--session", "ses_undo", "--redo")
    expect(empty.code).toBe(1)
    expect(empty.stderr).toContain("Nothing to redo")
    expect(stages).toHaveLength(2)
  } finally {
    server.stop(true)
    await fs.rm(home, { recursive: true, force: true })
  }
}, 30_000)
