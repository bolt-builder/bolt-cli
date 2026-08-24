import { describe, expect, test } from "bun:test"
import type { Hooks } from "@opencode-ai/plugin"
import { candidate, known, match } from "../../src/plugin/cli"

describe("known", () => {
  test("collects first words of command strings and aliases", () => {
    const names = known([
      { command: "run [message..]" },
      { command: "plugin <module>", aliases: "plug" },
      { command: ["serve"] },
    ])
    expect(names.has("run")).toBe(true)
    expect(names.has("plugin")).toBe(true)
    expect(names.has("plug")).toBe(true)
    expect(names.has("serve")).toBe(true)
    expect(names.has("[message..]")).toBe(false)
  })

  test("excludes the default command", () => {
    expect(known([{ command: "$0 [project]" }]).has("$0")).toBe(false)
  })
})

describe("candidate", () => {
  const builtin = new Set(["run", "serve"])

  test("returns the first token when it is not builtin", () => {
    expect(candidate(["deploy", "prod"], builtin)).toBe("deploy")
  })

  test("ignores builtin commands, flags, and empty argv", () => {
    expect(candidate(["run", "hello"], builtin)).toBeUndefined()
    expect(candidate(["--help"], builtin)).toBeUndefined()
    expect(candidate([], builtin)).toBeUndefined()
  })
})

describe("match", () => {
  const deploy = { describe: "deploy the app", run: async () => {} }
  const hooks: Hooks[] = [{}, { cli: { deploy } }, { cli: { deploy: { run: async () => {} } } }]

  test("returns the first registration for the name", () => {
    expect(match(hooks, "deploy")).toBe(deploy)
  })

  test("returns undefined when nothing claims the name", () => {
    expect(match(hooks, "release")).toBeUndefined()
    expect(match([{}], "deploy")).toBeUndefined()
  })
})
