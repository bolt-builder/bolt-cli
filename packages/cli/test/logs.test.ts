import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"
import { filter, level } from "../src/commands/handlers/logs"

const info = "timestamp=2026-08-07T18:51:46.677Z level=INFO run=91e0988c message=loading"
const error = "timestamp=2026-08-07T18:51:46.677Z level=ERROR run=91e0988c message=boom session.id=ses_123"
const debug = "timestamp=2026-08-07T18:51:46.677Z level=DEBUG run=91e0988c message=noise session.id=ses_456"

describe("logs level parsing", () => {
  test("extracts the level field", () => {
    expect(level(info)).toBe("INFO")
    expect(level(error)).toBe("ERROR")
  })

  test("returns undefined for lines without a level", () => {
    expect(level("    at foo (bar.ts:1:1)")).toBeUndefined()
  })
})

describe("logs filter", () => {
  test("keeps everything by default", () => {
    const keep = filter({})
    expect(keep(info)).toBe(true)
    expect(keep(debug)).toBe(true)
  })

  test("applies minimum level", () => {
    const keep = filter({ level: "WARN" })
    expect(keep(info)).toBe(false)
    expect(keep(error)).toBe(true)
    expect(keep(debug)).toBe(false)
  })

  test("filters by session id", () => {
    const keep = filter({ session: "ses_123" })
    expect(keep(error)).toBe(true)
    expect(keep(debug)).toBe(false)
    expect(keep(info)).toBe(false)
  })

  test("combines level and session filters", () => {
    const keep = filter({ level: "DEBUG", session: "ses_456" })
    expect(keep(debug)).toBe(true)
    expect(keep(error)).toBe(false)
  })

  test("continuation lines inherit the previous decision", () => {
    const keep = filter({ level: "ERROR" })
    expect(keep(error)).toBe(true)
    expect(keep("    at foo (bar.ts:1:1)")).toBe(true)
    expect(keep(info)).toBe(false)
    expect(keep("    at foo (bar.ts:1:1)")).toBe(false)
  })
})

test("V2 logs emits filtered history, versioned JSON, escaped TSV and validates streaming conflicts", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-logs-"))
  const file = path.join(root, "fixture.log")
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        path.resolve(import.meta.dir, "../src/index.ts"),
        "logs",
        "--file",
        file,
        ...args,
      ],
      { cwd: root, env: isolatedEnv(root), stdout: "pipe", stderr: "pipe", stdin: "ignore" },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text().then((text) => text.replaceAll("\r\n", "\n")),
      new Response(child.stderr).text().then((text) => text.replaceAll("\r\n", "\n")),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  try {
    await Bun.write(file, [debug, error, "    at fixture (a.ts:1:1)", info, ""].join("\n"))
    const json = await cli("--level", "ERROR", "--session", "ses_123", "--json")
    expect(json.code).toBe(0)
    expect(JSON.parse(json.stdout)).toEqual({
      version: 1,
      ok: true,
      result: { file, lines: [error, "    at fixture (a.ts:1:1)"] },
    })
    expect((await cli("--tail", "0")).stdout).toBe("")
    expect((await cli("--tail", "1")).stdout).toBe(info + "\n")
    expect((await cli("--porcelain", "--tail", "1")).stdout).toBe(`log\t${info}\n`)
    expect((await cli("--json", "--follow")).code).toBe(1)
    expect((await cli("--tail", "-1")).code).toBe(1)
    await fs.unlink(file)
    const missing = await cli("--json")
    expect(missing.code).toBe(1)
    expect(JSON.parse(missing.stdout).ok).toBe(false)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test("log following buffers appended lines, preserves session filtering and stops on SIGINT", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-logs-follow-"))
  const file = path.join(root, "fixture.log")
  await Bun.write(file, "level=INFO session.id=ses_123 message=ready\n")
  const child = Bun.spawn(
    [
      process.execPath,
      "run",
      "--jsx-import-source=@opentui/solid",
      path.resolve(import.meta.dir, "../src/index.ts"),
      "logs",
      "--file",
      file,
      "--session",
      "ses_123",
      "--follow",
    ],
    { cwd: root, env: isolatedEnv(root), stdout: "pipe", stderr: "pipe", stdin: "ignore" },
  )
  const output: string[] = []
  const reading = (async () => {
    for await (const chunk of child.stdout) output.push(Buffer.from(chunk).toString())
  })()
  const errors = new Response(child.stderr).text()
  const wait = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000
    while (!predicate() && Date.now() < deadline) await Bun.sleep(10)
    expect(predicate()).toBe(true)
  }
  try {
    await wait(() => output.join("").includes("message=ready"))
    // The first output is written immediately before the watcher is acquired.
    await Bun.sleep(30)
    await fs.appendFile(file, "level=ERROR session.id=ses_123 message=hel")
    await Bun.sleep(30)
    expect(output.join("")).not.toContain("message=hel")
    await fs.appendFile(file, "lo\n    at same-session\nlevel=INFO session.id=ses_456 message=hidden\n    at hidden\n")
    await wait(() => output.join("").includes("at same-session"))
    expect(output.join("")).toContain("message=hello\n")
    expect(output.join("")).not.toContain("hidden")
    child.kill("SIGINT")
    const exited = await Promise.race([child.exited.then(() => true), Bun.sleep(5000).then(() => false)])
    expect(exited).toBe(true)
  } finally {
    child.kill()
    await child.exited
    await reading
    await errors
    await fs.rm(root, { recursive: true, force: true })
  }
})

test("session-filtered continuations cannot include another session", () => {
  const keep = filter({ session: "ses_123" })
  expect(keep("level=INFO session.id=ses_123 message=ok")).toBe(true)
  expect(keep("  sessionID=ses_456 secret")).toBe(false)
  expect(keep("  continuation for current entry")).toBe(true)
})
