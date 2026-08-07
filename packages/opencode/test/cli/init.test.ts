import { describe, expect, test } from "bun:test"
import path from "path"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { PRESETS, seed } from "../../src/cli/cmd/init"
import { ConfigAgent } from "../../src/config/agent"
import { ConfigCommand } from "../../src/config/command"
import { ConfigParse } from "../../src/config/parse"
import { tmpdir } from "../fixture/fixture"

describe("seed", () => {
  test("creates a minimal bolt.jsonc without a preset", async () => {
    await using tmp = await tmpdir()
    const result = await seed(tmp.path)
    expect(result.created).toEqual([path.join(tmp.path, "bolt.jsonc")])
    const config = ConfigParse.jsonc(await Bun.file(path.join(tmp.path, "bolt.jsonc")).text(), "bolt.jsonc")
    expect(config).toEqual({ $schema: "https://opencode.ai/config.json" })
  })

  test("never overwrites existing files", async () => {
    await using tmp = await tmpdir()
    await Bun.write(path.join(tmp.path, "bolt.jsonc"), '{"model":"keep/me"}')
    const result = await seed(tmp.path, PRESETS.library)
    expect(result.skipped).toEqual([path.join(tmp.path, "bolt.jsonc")])
    expect(await Bun.file(path.join(tmp.path, "bolt.jsonc")).text()).toBe('{"model":"keep/me"}')
    expect(result.created.length).toBeGreaterThan(0)
  })

  test.each(Object.entries(PRESETS))("preset %s seeds valid config, agents, and commands", async (name, preset) => {
    await using tmp = await tmpdir()
    const result = await seed(tmp.path, preset)
    expect(result.skipped).toEqual([])

    const text = await Bun.file(path.join(tmp.path, "bolt.jsonc")).text()
    const config = ConfigParse.schema(ConfigV1.Info, ConfigParse.jsonc(text, "bolt.jsonc"), "bolt.jsonc")
    expect(config.$schema).toBe("https://opencode.ai/config.json")

    const agents = await ConfigAgent.load(path.join(tmp.path, ".bolt"))
    expect(Object.keys(agents).sort()).toEqual(Object.keys(preset.agents).sort())

    const commands = await ConfigCommand.load(path.join(tmp.path, ".bolt"))
    expect(Object.keys(commands).sort()).toEqual(Object.keys(preset.commands).sort())
    for (const command of Object.values(commands)) expect(command.template.length).toBeGreaterThan(0)
  })

  test("monorepo preset carries watcher ignores", async () => {
    await using tmp = await tmpdir()
    await seed(tmp.path, PRESETS.monorepo)
    const text = await Bun.file(path.join(tmp.path, "bolt.jsonc")).text()
    const config = ConfigParse.schema(ConfigV1.Info, ConfigParse.jsonc(text, "bolt.jsonc"), "bolt.jsonc")
    expect(config.watcher?.ignore).toContain("**/node_modules/**")
  })
})
