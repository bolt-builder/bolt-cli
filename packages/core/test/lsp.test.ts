import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Effect, Exit, Layer } from "effect"
import { LSP } from "@opencode/core/lsp"
import { LspServers } from "@opencode/core/lsp/servers"
import { Config } from "@opencode/core/config"
import { Document, Info } from "@opencode/schema/config"
import { ConfigLSP } from "@opencode/schema/config/lsp"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Environment } from "@opencode/core/environment/index"
import { Location } from "@opencode/core/location"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { testEffect } from "./lib/effect"
import { tempLocationLayer } from "./fixture/location"

const document = (lsp: typeof ConfigLSP.Info.Type) => new Document({ type: "document", info: new Info({ lsp }) })
const server = (env: Record<string, string> = {}) =>
  new ConfigLSP.Server({
    command: [process.execPath, path.join(import.meta.dir, "fixture/lsp-language-server.ts")],
    extensions: [".fixture"],
    env,
    initialization: { fixture: { enabled: true } },
  })
const configLayer = Config.testLayer()
const it = testEffect(
  Layer.merge(
    configLayer,
    AppNodeBuilder.build(LayerNode.group([LSP.node, Location.node, Environment.node]), [
      Config.node.replace(configLayer),
      Location.node.replace(tempLocationLayer),
    ]),
  ),
)

describe("LSP server settings", () => {
  test("disables all servers and merges named overrides without losing other sources", () => {
    expect(LspServers.resolve([document(false)])).toEqual([])
    const result = LspServers.resolve([
      document({ fixture: server(), typescript: { disabled: true } }),
      document({ pyright: { disabled: true } }),
    ])
    expect(result.some((entry) => entry.id === "typescript")).toBe(false)
    expect(result.some((entry) => entry.id === "pyright")).toBe(false)
    expect(result.find((entry) => entry.id === "fixture")).toMatchObject({ command: server().command, custom: true })
  })
})
it.live("LSP finds nearest roots, project fallback, ancestor exclusions and glob markers", () =>
  Effect.gen(function* () {
    const location = yield* Location.Service
    const { files } = yield* Environment.Service
    const nested = path.join(location.directory, "nested")
    yield* Effect.promise(() => fs.mkdir(nested))
    const file = path.join(nested, "source.fixture")
    const entry = { id: "fixture", command: [], extensions: [], markers: ["project.json"] }
    expect(yield* LspServers.root(files, file, location.directory, entry)).toBe(location.directory)
    yield* Effect.promise(() => fs.writeFile(path.join(nested, "project.json"), "{}"))
    expect(yield* LspServers.root(files, file, location.directory, entry)).toBe(nested)
    yield* Effect.promise(() => fs.writeFile(path.join(location.directory, "deno.json"), "{}"))
    expect(
      yield* LspServers.root(files, file, location.directory, { ...entry, exclude: ["deno.json"] }),
    ).toBeUndefined()
    yield* Effect.promise(() => fs.writeFile(path.join(location.directory, "sample.sln"), ""))
    expect(yield* LspServers.root(files, file, location.directory, { ...entry, markers: ["*.sln"] })).toBe(
      location.directory,
    )
    expect(
      yield* LspServers.root(files, path.join(path.dirname(location.directory), "outside"), location.directory, entry),
    ).toBeUndefined()
  }),
)
for (const pull of [false, true])
  it.live(`LSP initializes, synchronizes documents and refreshes ${pull ? "pull" : "push"} diagnostics`, () =>
    Effect.gen(function* () {
      const config = yield* Config.Test
      const lsp = yield* LSP.Service
      const location = yield* Location.Service
      yield* config.setEntries([
        document(false),
        document({ fixture: server({ FIXTURE_PULL: pull ? "1" : "0", FIXTURE_VALUE: "synthetic" }) }),
      ])
      const file = path.join(location.directory, "source.fixture")
      yield* Effect.promise(() => fs.writeFile(file, "broken"))
      expect(yield* lsp.touchFile(file, "full")).toBe(1)
      expect((yield* lsp.diagnostics())[file]).toHaveLength(1)
      const [state] = yield* lsp.request(file, "fixture/state", {})
      expect(state).toMatchObject({
        initialized: true,
        configuration: { fixture: { enabled: true } },
        environment: "synthetic",
        root: location.directory,
        documents: [[pathToFileURL(file).href, { text: "broken", version: 1 }]],
      })
      yield* Effect.promise(() => fs.writeFile(file, "valid"))
      yield* lsp.touchFile(file, "full")
      yield* lsp.request(file, "fixture/stale", { uri: pathToFileURL(file).href })
      expect((yield* lsp.diagnostics())[file]).toEqual([])
      const [second] = yield* lsp.request(file, "fixture/state", {})
      expect(second).toMatchObject({ documents: [[pathToFileURL(file).href, { text: "valid", version: 2 }]] })
      expect(yield* lsp.status()).toMatchObject([{ id: "fixture", root: location.directory, closed: false }])
      yield* config.setEntries([document(false)])
      expect(yield* lsp.touchFile(file)).toBe(0)
      expect(yield* lsp.status()).toEqual([])
      expect(yield* lsp.diagnostics()).toEqual({})
    }),
  )
it.live("LSP routes all V1 operations and call hierarchy items through their owning server", () =>
  Effect.gen(function* () {
    const config = yield* Config.Test
    const lsp = yield* LSP.Service
    const location = yield* Location.Service
    yield* config.setEntries([document(false), document({ fixture: server() })])
    const file = path.join(location.directory, "source.fixture")
    yield* Effect.promise(() => fs.writeFile(file, "valid"))
    yield* lsp.touchFile(file)
    for (const operation of LSP.operations) {
      const result = yield* lsp.query(file, operation, { line: 1, character: 2 }, "symbol")
      if (operation === "prepareCallHierarchy") {
        expect(result).toMatchObject([{ name: "fixture" }])
        continue
      }
      if (operation === "findReferences") {
        expect(result).toMatchObject([{ uri: pathToFileURL(file).href }])
        continue
      }
      expect(result).toHaveLength(1)
      if (operation === "workspaceSymbol")
        expect(result[0]).toMatchObject({ method: "workspace/symbol", params: { query: "symbol" } })
      else if (operation === "incomingCalls" || operation === "outgoingCalls")
        expect(result[0]).toMatchObject({ method: `callHierarchy/${operation}`, params: { item: { name: "fixture" } } })
      else if (operation === "documentSymbol")
        expect(result[0]).toMatchObject({ params: { textDocument: { uri: pathToFileURL(file).href } } })
      else expect(result[0]).toMatchObject({ params: { position: { line: 1, character: 2 } } })
    }
    expect(Exit.isFailure(yield* Effect.exit(lsp.touchFile(path.join(location.directory, "absent.fixture"))))).toBe(
      true,
    )
  }),
)

it.live("LSP retains diagnostics and call hierarchy ownership across multiple servers", () =>
  Effect.gen(function* () {
    const config = yield* Config.Test
    const lsp = yield* LSP.Service
    const location = yield* Location.Service
    yield* config.setEntries([
      document(false),
      document({ first: server({ FIXTURE_SOURCE: "first" }), second: server({ FIXTURE_SOURCE: "second" }) }),
    ])
    const file = path.join(location.directory, "source.fixture")
    yield* Effect.promise(() => fs.writeFile(file, "broken"))
    expect(yield* lsp.touchFile(file, "full")).toBe(2)
    expect((yield* lsp.diagnostics())[file].map((item) => item.source).sort()).toEqual(["first", "second"])
    expect(yield* lsp.query(file, "incomingCalls", { line: 1, character: 2 })).toHaveLength(2)
    yield* lsp.closeFile(file)
    expect(yield* lsp.diagnostics()).toEqual({})
  }),
)

it.live("LSP supports dynamically registered diagnostic identifiers, related documents and workspace pulls", () =>
  Effect.gen(function* () {
    const config = yield* Config.Test
    const lsp = yield* LSP.Service
    const location = yield* Location.Service
    yield* config.setEntries([document(false), document({ fixture: server({ FIXTURE_PULL: "dynamic" }) })])
    const file = path.join(location.directory, "source.fixture")
    yield* Effect.promise(() => fs.writeFile(file, "broken"))
    expect(yield* lsp.touchFile(file, "full")).toBe(1)
    const all = yield* lsp.diagnostics()
    expect(Object.keys(all).sort()).toEqual(
      [
        file,
        path.join(location.directory, "related.fixture"),
        path.join(location.directory, "workspace.fixture"),
      ].sort(),
    )
    expect(all[file]).toHaveLength(1)
    expect(all[path.join(location.directory, "related.fixture")]).toHaveLength(1)
    yield* lsp.touchFile(file, "full")
    const [state] = yield* lsp.request(file, "fixture/state", {})
    expect(state).toMatchObject({
      documentRequest: { identifier: "fixture", previousResultId: "doc-1" },
      workspaceRequest: {
        identifier: "fixture",
        previousResultIds: expect.arrayContaining([
          { uri: pathToFileURL(file).href, value: "doc-1" },
          { uri: pathToFileURL(path.join(location.directory, "workspace.fixture")).href, value: "workspace-1" },
        ]),
      },
    })
  }),
)
