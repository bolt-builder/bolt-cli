import { describe, expect, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Daemon } from "../../src/cli/daemon"

function target() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bolt-daemon-")), "daemon.json")
}

describe("daemon discovery", () => {
  test("read returns undefined when the record is missing", async () => {
    expect(await Daemon.read(target())).toBeUndefined()
  })

  test("read returns undefined for malformed records", async () => {
    const file = target()
    await Bun.write(file, "not json")
    expect(await Daemon.read(file)).toBeUndefined()
    await Bun.write(file, JSON.stringify({ url: 1, pid: "x" }))
    expect(await Daemon.read(file)).toBeUndefined()
  })

  test("write then read roundtrips", async () => {
    const file = target()
    const info = { url: "http://127.0.0.1:4096", pid: process.pid, started: Date.now() }
    await Daemon.write(info, file)
    expect(await Daemon.read(file)).toEqual(info)
  })

  test("clear removes the record", async () => {
    const file = target()
    await Daemon.write({ url: "http://127.0.0.1:4096", pid: process.pid, started: Date.now() }, file)
    Daemon.clear(file)
    expect(await Daemon.read(file)).toBeUndefined()
  })

  test("alive reflects process existence", () => {
    expect(Daemon.alive(process.pid)).toBe(true)
    expect(Daemon.alive(2 ** 30)).toBe(false)
  })

  test("probe accepts a healthy server and rejects everything else", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname === "/global/health") return Response.json({ healthy: true, version: "test" })
        return new Response("not found", { status: 404 })
      },
    })
    const url = `http://127.0.0.1:${server.port}`
    expect(await Daemon.probe(url)).toBe(true)
    await server.stop(true)
    expect(await Daemon.probe(url, 500)).toBe(false)
  })

  test("detect drops records for dead processes", async () => {
    const file = target()
    await Daemon.write({ url: "http://127.0.0.1:1", pid: 2 ** 30, started: Date.now() }, file)
    expect(await Daemon.detect(file)).toBeUndefined()
    expect(fs.existsSync(file)).toBe(false)
  })

  test("detect returns a live daemon", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({ healthy: true, version: "test" })
      },
    })
    const file = target()
    const info = { url: `http://127.0.0.1:${server.port}`, pid: process.pid, started: Date.now() }
    await Daemon.write(info, file)
    expect(await Daemon.detect(file)).toEqual(info)
    await server.stop(true)
  })
})
