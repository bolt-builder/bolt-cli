import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

const entry = path.resolve(import.meta.dir, "../src/index.ts")

test("index CLI refreshes/query source, retains unchanged vectors, removes deleted files and preserves invalid stored data", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-index-"))
  const cli = async (...args: string[]) => {
    const child = Bun.spawn([process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, "index", ...args], {
      cwd: root,
      env: isolatedEnv(root),
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  try {
    await Bun.write(
      path.join(root, "src", "cache.ts"),
      "export function invalidateCache() { return expiredEntries() }\n",
    )
    await Bun.write(path.join(root, "node_modules", "ignored.ts"), "export const invalidateCache = true\n")
    const first = await cli("invalidate cache")
    expect(first.code).toBe(0)
    expect(first.stdout).toContain("src/cache.ts:1-2")
    const out = path.join(root, "codebase-index.json")
    const stored = await Bun.file(out).text()
    expect(Object.keys(JSON.parse(stored).files)).toEqual(["src/cache.ts"])
    expect((await cli()).stderr).toContain("+0 ~0 -0 =1")
    expect(await Bun.file(out).text()).toBe(stored)
    await Bun.write(path.join(root, "src", "cache.ts"), "export function resolveConfig() { return settings() }\n")
    expect((await cli()).stderr).toContain("+0 ~1 -0 =0")
    await fs.unlink(path.join(root, "src", "cache.ts"))
    expect((await cli()).stderr).toContain("+0 ~0 -1 =0")
    await Bun.write(out, '{"version":2,"files":{}}')
    expect((await cli()).code).toBe(1)
    expect(await Bun.file(out).text()).toBe('{"version":2,"files":{}}')
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test("index watch refreshes saved and removed sources and exits after interruption", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-index-watch-"))
  const source = path.join(root, "fixture.ts")
  const out = path.join(root, "index.json")
  await Bun.write(source, "export const initial = true\n")
  const child = Bun.spawn(
    [process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, "index", "--watch", "--out", out],
    { cwd: root, env: isolatedEnv(root), stdout: "pipe", stderr: "pipe", stdin: "ignore" },
  )
  const errors: string[] = []
  const stderr = (async () => {
    for await (const chunk of child.stderr) errors.push(Buffer.from(chunk).toString())
  })()
  const stdout = new Response(child.stdout).text()
  const wait = async (check: () => Promise<boolean>) => {
    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      if (await check()) return
      await Bun.sleep(20)
    }
    throw new Error("Index watcher did not reach expected state: " + errors.join(""))
  }
  try {
    await wait(async () => errors.join("").includes("Watching for saves"))
    const initial = await Bun.file(out).text()
    await Bun.write(source, "export function cacheRefresh() { return changed() }\n")
    await wait(async () => (await Bun.file(out).text()) !== initial)
    expect(errors.join("")).toContain("~1")
    await fs.unlink(source)
    await wait(async () => Object.keys((await Bun.file(out).json()).files).length === 0)
    child.kill("SIGINT")
    expect(await Promise.race([child.exited.then(() => true), Bun.sleep(5000).then(() => false)])).toBe(true)
  } finally {
    child.kill()
    await child.exited
    await stderr
    await stdout
    await fs.rm(root, { recursive: true, force: true })
  }
})
