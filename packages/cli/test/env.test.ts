import { expect, test } from "bun:test"
import { Env } from "../src/env"
import { apply } from "../src/env-compat"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

test("session environment omits server credentials", () => {
  const names = ["OPENCODE_PASSWORD", "OPENCODE_SERVER_PASSWORD", "BOLT_PASSWORD", "BOLT_SERVER_PASSWORD"]
  const previous = names.map((name) => process.env[name])
  try {
    for (const name of names) process.env[name] = "synthetic"
    const environment = Env.session()
    for (const name of names) expect(environment[name]).toBeUndefined()
    expect(environment).toHaveProperty("PATH", process.env.PATH)
  } finally {
    names.forEach((name, i) => {
      const value = previous[i]
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    })
  }
})

test("Bolt environment aliases preserve explicit V2 values and do not invent unset values", () => {
  const environment = {
    BOLT_CONFIG_DIR: "/old/config",
    BOLT_CONFIG_CONTENT: "{}",
    OPENCODE_CONFIG_CONTENT: "",
    BOLT_SERVER_PASSWORD: "synthetic",
    BOLT_EXPERIMENTAL_DISABLE_FILEWATCHER: "true",
    BOLT_DB: ":memory:",
  }
  apply(environment)
  expect(environment).toMatchObject({
    OPENCODE_CONFIG_DIR: "/old/config",
    OPENCODE_CONFIG_CONTENT: "",
    OPENCODE_SERVER_PASSWORD: "synthetic",
    OPENCODE_DISABLE_FILEWATCHER: "true",
    OPENCODE_DB: ":memory:",
  })
  expect(Object.keys(environment)).not.toContain("OPENCODE_MODELS_PATH")
})

test("Bolt startup environment is applied before global paths are captured", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-startup-env-"))
  try {
    const config = path.join(root, "custom-bolt-config")
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        "--jsx-import-source=@opentui/solid",
        path.resolve(import.meta.dir, "../src/index.ts"),
        "debug",
        "paths",
        "config",
      ],
      {
        cwd: root,
        env: isolatedEnv(root, { OPENCODE_CONFIG_DIR: undefined, BOLT_CONFIG_DIR: config }),
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect(code, stderr).toBe(0)
    expect(stdout.trim()).toBe(config)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
