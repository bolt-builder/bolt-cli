import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const entry = path.resolve(import.meta.dir, "../src/index.ts")

test("map, architecture and ownership reports run through the V2 CLI", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-reports-"))
  const run = async (args: string[]) => {
    const child = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  const cli = (...args: string[]) =>
    run([process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, ...args])
  const git = async (...args: string[]) => {
    const result = await run(["git", "-c", "core.autocrlf=false", ...args])
    expect({ code: result.code, stderr: result.stderr }).toEqual({ code: 0, stderr: "" })
  }
  try {
    await Bun.write(path.join(cwd, "lib/shared.ts"), "export const value = 1\n")
    await Bun.write(path.join(cwd, "src/ui/view.ts"), 'import { value } from "../../lib/shared"\nconsole.log(value)\n')
    await Bun.write(path.join(cwd, "node_modules/ignored/index.ts"), "export const ignored = true\n")
    const mapped = await cli("map", "--depth", "1", "--out", "map.md")
    expect(mapped).toEqual({ stdout: "", stderr: "Wrote codebase map for 2 files to map.md\n", code: 0 })
    const map = await Bun.file(path.join(cwd, "map.md")).text()
    expect(map).toContain('d0["lib"]')
    expect(map).toContain('d1["src"]')
    expect(map).toContain("d1 --> d0")
    await Bun.write(
      path.join(cwd, "architecture.json"),
      JSON.stringify({ depth: 1, rules: [{ from: "src", allow: ["lib"] }] }),
    )
    const allowed = await cli("arch")
    expect({ code: allowed.code, stderr: allowed.stderr }).toEqual({
      code: 0,
      stderr: "Checked 1 edges against 1 rules\n",
    })
    expect(allowed.stdout).toContain("No drift: 1 import edges")
    await Bun.write(
      path.join(cwd, "architecture.json"),
      JSON.stringify({ depth: 1, rules: [{ from: "src", allow: [] }] }),
    )
    const denied = await cli("arch")
    expect(denied.code).toBe(1)
    expect(denied.stdout).toContain("src/ui/view.ts")
    expect(denied.stdout).toContain("src -> lib")
    await git("init", "-q", "-b", "main")
    await Bun.write(path.join(cwd, "CODEOWNERS"), "lib/ @fixture/library\nsrc/ @fixture/ui\n")
    await git("add", "lib", "src", "CODEOWNERS")
    await git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "initial")
    const owners = await cli("owners", "--depth", "1")
    expect(owners.code).toBe(0)
    expect(owners.stderr).toContain("3 directories from 2 CODEOWNERS rules")
    const author = (await run(["git", "log", "-1", "--format=%an"])).stdout.trim()
    expect(owners.stdout).toContain(`${author} (100%)`)
    expect(owners.stdout).toContain("@fixture/library")
    expect(owners.stdout).toContain("@fixture/ui")
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})
