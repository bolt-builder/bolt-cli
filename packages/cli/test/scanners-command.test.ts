import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const entry = path.resolve(import.meta.dir, "../src/index.ts")

test("legacy scanners run through the V2 CLI without starting a server", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-scanners-"))
  const cli = async (...args: string[]) => {
    const child = Bun.spawn([process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, ...args], {
      cwd,
      env: { ...process.env, XDG_STATE_HOME: path.join(cwd, "state") },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect({ code, stderr: code ? stderr : "" }).toEqual({ code: 0, stderr: "" })
    return { stdout, stderr }
  }
  try {
    await Bun.write(path.join(cwd, "lib/exports.ts"), "export const orphan = 1\nexport const used = 2\n")
    await Bun.write(path.join(cwd, "lib/consumer.ts"), 'import { used } from "./exports"\nconsole.log(used)\n')
    await Bun.write(path.join(cwd, "node_modules/ignored/index.ts"), "export const ignored = 3\n")
    const dead = await cli("dead")
    expect(dead.stdout).toContain("orphan")
    expect(dead.stdout).not.toContain("`used`")
    expect(dead.stdout).not.toContain("ignored")
    const block =
      "const first = load(input)\nif (!first) return fallback\nconst second = transform(first)\nif (!second) return fallback\nreturn persist(second)\n"
    await Bun.write(path.join(cwd, "lib/a.ts"), block)
    await Bun.write(path.join(cwd, "lib/b.ts"), block)
    const dupes = await cli("dupes", "--window", "3")
    expect(dupes.stdout).toContain("lib/a.ts:1-5")
    expect(dupes.stdout).toContain("lib/b.ts:1-5")
    expect(dupes.stderr).toContain("Scanned 4 files")
    await Bun.write(path.join(cwd, "packages/base/package.json"), JSON.stringify({ name: "@test/base" }))
    await Bun.write(
      path.join(cwd, "packages/app/package.json"),
      JSON.stringify({ name: "@test/app", dependencies: { "@test/base": "workspace:*" } }),
    )
    await Bun.write(path.join(cwd, "node_modules/ignored/package.json"), JSON.stringify({ name: "ignored" }))
    await Bun.write(path.join(cwd, "broken/package.json"), "invalid json")
    const packages = await cli("packages", "--out", "graph.md")
    expect(packages.stdout).toBe("")
    expect(packages.stderr).toContain("2 packages")
    const graph = await Bun.file(path.join(cwd, "graph.md")).text()
    expect(graph).toContain("| 1 | `@test/base` |")
    expect(graph).toContain("| 2 | `@test/app` |")
    expect(graph).not.toContain("ignored")
    expect(await Bun.file(path.join(cwd, "state/opencode/service-local.json")).exists()).toBe(false)
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})
