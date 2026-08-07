import { describe, expect, test } from "bun:test"
import path from "path"
import { Effect, Layer } from "effect"
import { HttpClient } from "effect/unstable/http"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { httpClient } from "@opencode-ai/core/effect/app-node-platform"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { Npm } from "@opencode-ai/core/npm"
import { Config } from "@/config/config"
import { ConfigDoctor } from "@/config/doctor"
import { Auth } from "../../src/auth"
import { Account } from "../../src/account/account"
import { Env } from "../../src/env"
import { AccountTest } from "../fake/account"
import { AuthTest } from "../fake/auth"
import { NpmTest } from "../fake/npm"
import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const unexpectedHttp = HttpClient.make((request) =>
  Effect.die(`unexpected http request: ${request.method} ${request.url}`),
)

const layer = LayerNode.compile(LayerNode.group([Config.node, FSUtil.node, Env.node, CrossSpawnSpawner.node]), [
  [Auth.node, AuthTest.empty],
  [Account.node, AccountTest.empty],
  [Npm.node, NpmTest.noop],
  [httpClient, Layer.succeed(HttpClient.HttpClient, unexpectedHttp)],
])

const it = testEffect(layer)

describe("leaves", () => {
  test("walks nested objects into dot paths", () => {
    expect(ConfigDoctor.leaves({ model: "a/b", compaction: { auto: true, prune: false } }).sort()).toEqual([
      "compaction.auto",
      "compaction.prune",
      "model",
    ])
  })

  test("treats arrays and empty objects as leaves", () => {
    expect(ConfigDoctor.leaves({ instructions: ["A.md"] })).toEqual(["instructions"])
    expect(ConfigDoctor.leaves({ agent: {} })).toEqual(["agent"])
  })

  test("hides structural keys and empty configs", () => {
    expect(ConfigDoctor.leaves({ $schema: "x", model: "a/b" })).toEqual(["model"])
    expect(ConfigDoctor.leaves({})).toEqual([])
  })
})

describe("winners", () => {
  const origins = [
    { source: "global", config: { model: "g/model", snapshot: true } },
    { source: "project", config: { model: "p/model", compaction: { auto: false } } },
  ]

  test("later origins win keys they set, earlier keep the rest", () => {
    const won = ConfigDoctor.winners(origins)
    expect(won.get("model")).toBe("project")
    expect(won.get("snapshot")).toBe("global")
    expect(won.get("compaction.auto")).toBe("project")
  })
})

describe("winner", () => {
  const won = new Map([
    ["agent", "global"],
    ["model", "project"],
  ])

  test("falls back to the nearest ancestor path", () => {
    expect(ConfigDoctor.winner(won, "model")).toBe("project")
    expect(ConfigDoctor.winner(won, "agent.build.mode")).toBe("global")
    expect(ConfigDoctor.winner(won, "username")).toBeUndefined()
  })
})

describe("contributors", () => {
  const origins = [
    { source: "global", config: { instructions: ["G.md"] } },
    { source: "project", config: { model: "p/model" } },
    { source: "local", config: { instructions: ["L.md"] } },
  ]

  test("lists sources that set a key in load order", () => {
    expect(ConfigDoctor.contributors(origins, "instructions")).toEqual(["global", "local"])
    expect(ConfigDoctor.contributors(origins, "model")).toEqual(["project"])
  })
})

describe("Config.origins", () => {
  it.instance("records project config files as sources in load order", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const file = path.join(test.directory, "bolt.json")
      yield* FSUtil.use.writeWithDirs(file, JSON.stringify({ model: "doctor/model", snapshot: false }))

      const origins = yield* Config.use.origins()
      expect(origins.map((origin) => origin.source)).toContain(file)

      const won = ConfigDoctor.winners(origins)
      expect(won.get("model")).toBe(file)
      expect(won.get("snapshot")).toBe(file)

      const config = yield* Config.use.get()
      expect(config.model).toBe("doctor/model")
    }),
  )
})
