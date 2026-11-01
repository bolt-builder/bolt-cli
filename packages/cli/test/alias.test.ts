import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { CliAlias } from "../src/services/alias"
import { parse } from "jsonc-parser"
import { isolatedEnv } from "./fixture/environment"

test("V1 alias quoting, appended arguments, protected commands and one-level expansion", () => {
  expect(CliAlias.tokenize("run --agent reviewer 'audit the deploy diff'")).toEqual([
    "run",
    "--agent",
    "reviewer",
    "audit the deploy diff",
  ])
  expect(CliAlias.tokenize('run "two words" x')).toEqual(["run", "two words", "x"])
  expect(CliAlias.tokenize("run ''")).toEqual(["run", ""])
  const aliases = { check: "run 'audit the deploy diff'", a: "b", b: "run", alias: "run" }
  expect(CliAlias.expand(["check", "--model", "a/b"], aliases)).toEqual([
    "run",
    "audit the deploy diff",
    "--model",
    "a/b",
  ])
  expect(CliAlias.expand(["a"], aliases)).toEqual(["b"])
  for (const args of [[], ["--help"], ["alias", "check"], ["unknown"], ["constructor"], ["toString"]])
    expect(CliAlias.expand(args, aliases)).toEqual(args)
})

test("global and nested Bolt JSONC aliases retain nearest-project precedence and ignore invalid entries", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-alias-"))
  try {
    const project = path.join(root, "project")
    const nested = path.join(project, "packages", "app")
    const config = path.join(root, "config")
    await fs.mkdir(nested, { recursive: true })
    await fs.mkdir(config)
    await Bun.write(path.join(config, "bolt.jsonc"), '{/* keep */ "alias": { "check": "global", "up": "upgrade" }}')
    await Bun.write(path.join(project, "bolt.json"), JSON.stringify({ alias: { check: "project", lint: "run lint" } }))
    await Bun.write(path.join(nested, ".bolt", "bolt.jsonc"), '{"alias": {"check": "nearest", "bad": 42,},}')
    expect(CliAlias.load(nested, config, { check: "cli", extra: "stats", up: "stats" })).toEqual({
      check: "nearest",
      extra: "stats",
      up: "stats",
      lint: "run lint",
    })
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test("real CLI aliases preserve config comments, expand before parsing, persist and remove", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-alias-cli-"))
  const config = path.join(root, "config", "cli.json")
  const cli = async (...args: string[]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        path.resolve(import.meta.dir, "../src/index.ts"),
        ...args,
      ],
      { cwd: root, env: isolatedEnv(root), stdout: "pipe", stderr: "pipe", stdin: "ignore" },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  try {
    await Bun.write(config, '{\n  // Preserve settings\n  "theme": { "name": "bolt" }\n}\n')
    expect(await cli("alias", "report=hotspots --limit 1")).toMatchObject({ code: 0 })
    expect((await cli("alias", "report")).stdout).toContain('report="hotspots --limit 1"')
    const expanded = await cli("report", "--help")
    expect(expanded.code).toBe(0)
    expect(expanded.stdout).toContain("hotspots")
    expect(expanded.stdout).toContain("--limit")
    expect(await Bun.file(config).text()).toContain("// Preserve settings")
    expect((await cli("alias")).stdout).toContain("report=")
    expect((await cli("alias", "alias=run")).code).toBe(1)
    expect((await cli("alias", "empty=  ")).code).toBe(1)
    expect((await cli("alias", "--rm", "report")).code).toBe(0)
    expect((await cli("alias", "report")).code).toBe(1)
    expect(parse(await Bun.file(config).text()).theme).toEqual({ name: "bolt" })
    await Bun.write(path.join(root, ".bolt", "bolt.json"), '{"alias": {"local": "hotspots --limit 2"}}')
    expect((await cli("local", "--help")).stdout).toContain("hotspots")
    expect((await cli("alias", "--rm", "local")).stderr).toContain("remove it from that file")
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
