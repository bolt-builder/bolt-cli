import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { PRESETS, seed } from "../src/commands/handlers/init"
import { isolatedEnv } from "./fixture/environment"

test("init preserves user files and seeds all original Bolt project presets", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-init-"))
  try {
    const minimal = path.join(root, "minimal")
    expect((await seed(minimal)).created).toEqual([path.join(minimal, "bolt.jsonc")])
    expect(await Bun.file(path.join(minimal, "bolt.jsonc")).json()).toEqual({ $schema: "https://bolt.ai/config.json" })
    for (const [name, preset] of Object.entries(PRESETS)) {
      const project = path.join(root, name)
      const result = await seed(project, preset)
      expect(result.skipped).toEqual([])
      expect(result.created).toHaveLength(1 + Object.keys(preset.agents).length + Object.keys(preset.commands).length)
      for (const agent of Object.keys(preset.agents))
        expect(await Bun.file(path.join(project, ".bolt/agent", `${agent}.md`)).text()).toContain("mode: subagent")
      for (const command of Object.keys(preset.commands))
        expect(await Bun.file(path.join(project, ".bolt/command", `${command}.md`)).text()).toContain("!`git ")
      expect((await seed(project, preset)).created).toEqual([])
    }
    expect((await Bun.file(path.join(root, "monorepo/bolt.jsonc")).json()).watcher.ignore).toContain(
      "**/node_modules/**",
    )
    await Bun.write(path.join(minimal, "bolt.jsonc"), '{"model":"keep/me"}\n')
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        path.resolve(import.meta.dir, "../src/index.ts"),
        "init",
        minimal,
        "--preset=library",
      ],
      { cwd: root, env: isolatedEnv(root), stdout: "pipe", stderr: "pipe" },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect({ stderr, code }).toEqual({ stderr: "", code: 0 })
    expect(stdout).toContain("skipped bolt.jsonc (already exists)")
    expect(stdout).toContain("Initialized for library")
    expect(await Bun.file(path.join(minimal, "bolt.jsonc")).text()).toBe('{"model":"keep/me"}\n')
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
