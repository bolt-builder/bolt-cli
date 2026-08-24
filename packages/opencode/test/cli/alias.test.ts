import { describe, expect, test } from "bun:test"
import path from "path"
import { CliAlias } from "../../src/cli/alias"
import { tmpdir } from "../fixture/fixture"

describe("tokenize", () => {
  test("splits on whitespace", () => {
    expect(CliAlias.tokenize("run --agent reviewer")).toEqual(["run", "--agent", "reviewer"])
  })

  test("keeps single-quoted and double-quoted strings whole", () => {
    expect(CliAlias.tokenize("run --agent reviewer 'audit the deploy diff'")).toEqual([
      "run",
      "--agent",
      "reviewer",
      "audit the deploy diff",
    ])
    expect(CliAlias.tokenize('run "two words" x')).toEqual(["run", "two words", "x"])
  })

  test("handles empty quoted strings", () => {
    expect(CliAlias.tokenize("run ''")).toEqual(["run", ""])
  })
})

describe("expand", () => {
  const aliases = { "deploy-check": "run --agent reviewer 'audit the deploy diff'" }

  test("expands a leading alias and keeps trailing args", () => {
    expect(CliAlias.expand(["deploy-check", "--model", "a/b"], aliases)).toEqual([
      "run",
      "--agent",
      "reviewer",
      "audit the deploy diff",
      "--model",
      "a/b",
    ])
  })

  test("leaves unknown commands, flags, and the alias command alone", () => {
    expect(CliAlias.expand(["run", "hi"], aliases)).toEqual(["run", "hi"])
    expect(CliAlias.expand(["--help"], aliases)).toEqual(["--help"])
    expect(CliAlias.expand([], aliases)).toEqual([])
    expect(CliAlias.expand(["alias", "deploy-check"], aliases)).toEqual(["alias", "deploy-check"])
  })

  test("expands only one level", () => {
    expect(CliAlias.expand(["a"], { a: "b", b: "run" })).toEqual(["b"])
  })
})

describe("load", () => {
  test("reads aliases from project config files, nearest winning", async () => {
    await using tmp = await tmpdir()
    const nested = path.join(tmp.path, "packages", "app")
    await Bun.write(
      path.join(tmp.path, "bolt.json"),
      JSON.stringify({ alias: { greet: "run 'hello'", up: "upgrade" } }),
    )
    await Bun.write(path.join(nested, "bolt.jsonc"), JSON.stringify({ alias: { greet: "run 'hi from nested'" } }))

    const found = CliAlias.load(nested)
    expect(found.greet).toBe("run 'hi from nested'")
    expect(found.up).toBe("upgrade")
  })

  test("reads aliases from dot directories and ignores non-string values", async () => {
    await using tmp = await tmpdir()
    await Bun.write(
      path.join(tmp.path, ".bolt", "bolt.json"),
      JSON.stringify({ alias: { lint: "run 'lint it'", bad: 42 } }),
    )
    const found = CliAlias.load(tmp.path)
    expect(found.lint).toBe("run 'lint it'")
    expect(found.bad).toBeUndefined()
  })

  test("returns empty for directories without config", async () => {
    await using tmp = await tmpdir()
    expect(CliAlias.load(tmp.path)).toEqual({})
  })
})
