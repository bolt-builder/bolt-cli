import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Effect, Layer } from "effect"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Config } from "@opencode/core/config"
import { Document, Info } from "@opencode/schema/config"
import { ConfigLSP } from "@opencode/schema/config/lsp"
import { Database } from "@opencode/core/database/database"
import { Bus } from "@opencode/core/bus"
import { Location } from "@opencode/core/location"
import { LocationServiceMap } from "@opencode/core/location-service-map"
import { LSP } from "@opencode/core/lsp"
import { Permission } from "@opencode/core/permission"
import { Plugin } from "@opencode/core/plugin"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { Tool } from "@opencode/core/tool"
import { DiagnosticsTool } from "@opencode/core/tool/plugin/diagnostics"
import { Global } from "@opencode/util/global"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { testEffect } from "./lib/effect"
import { executeTool, toolIdentity } from "./lib/tool"
import { permissionLayer } from "./lib/permission"
import { tmpdirScoped } from "./fixture/tmpdir"
import { tempGlobalLayer } from "./fixture/global"
import { offlineModels } from "./fixture/models"

const error: LSP.Diagnostic = {
  range: { start: { line: 1, character: 2 }, end: { line: 1, character: 4 } },
  message: "wrong",
  severity: 1,
  source: "fixture",
}
describe("diagnostic presentation", () => {
  test("filters path and severity, sorts positions and renders one-based coordinates", () => {
    const root = path.resolve("project")
    expect(
      DiagnosticsTool.filter(
        { [path.join(root, "a")]: [{ ...error, severity: 2 }, error], [root + "-other/a"]: [error] },
        { path: root, severity: "error" },
      ),
    ).toEqual({ [path.join(root, "a")]: [error] })
    expect(DiagnosticsTool.within(path.join(root, "..valid/file"), root)).toBe(true)
    expect(DiagnosticsTool.render({ "file.ts": [error] })).toBe(
      "1 diagnostic in 1 file:\nfile.ts:2:3 error wrong [fixture]",
    )
    expect(DiagnosticsTool.render({})).toBe("No diagnostics found.")
  })
})
testEffect(Layer.empty).live(
  "registered LSP/diagnostics and edit hooks preserve approvals, document versions and saved files",
  () => {
    let denied = ""
    const actions: string[] = []
    const permission = permissionLayer({
      assert: (input) =>
        Effect.sync(() => actions.push(input.action)).pipe(
          Effect.andThen(
            input.action === denied
              ? Effect.fail(
                  new Permission.BlockedError({ rules: [], permission: input.action, resources: input.resources }),
                )
              : Effect.void,
          ),
        ),
      assertNotDenied: (input) =>
        input.action === denied
          ? Effect.fail(
              new Permission.BlockedError({ rules: [], permission: input.action, resources: input.resources }),
            )
          : Effect.void,
      allows: () => Effect.succeed(true),
    })
    const config = Config.testLayer([
      new Document({ type: "document", info: new Info({ lsp: false }) }),
      new Document({
        type: "document",
        info: new Info({
          lsp: {
            fixture: new ConfigLSP.Server({
              command: [process.execPath, path.join(import.meta.dir, "fixture/lsp-language-server.ts")],
              extensions: [".fixture"],
            }),
          },
        }),
      }),
    ])
    return Effect.gen(function* () {
      const temp = yield* tmpdirScoped()
      const locations = yield* LocationServiceMap.Service
      yield* Effect.gen(function* () {
        const plugins = yield* Plugin.Service
        yield* plugins.awaitActivation
        const location = yield* Location.Service
        const lsp = yield* LSP.Service
        const tools = yield* Tool.Service
        const sessions = yield* Session.Service
        const session = yield* sessions.create({
          location: { directory: location.directory },
          agent: toolIdentity.agent,
        })
        const file = path.join(location.directory, "source.fixture")
        yield* Effect.promise(() => fs.writeFile(file, "valid"))
        const run = (name: string, input: Record<string, unknown>) =>
          executeTool(tools, {
            sessionID: session.id,
            ...toolIdentity,
            call: { type: "tool-call", id: "call-lsp", name, input },
            progress: () => Effect.void,
          })
        denied = "lsp"
        expect((yield* run("lsp", { operation: "hover", filePath: file, line: 2, character: 3 })).status).toBe("error")
        expect(yield* lsp.status()).toEqual([])
        denied = ""
        const hover = yield* run("lsp", { operation: "hover", filePath: file, line: 2, character: 3 })
        expect(hover).toMatchObject({
          status: "completed",
          output: { results: [{ method: "textDocument/hover", params: { position: { line: 1, character: 2 } } }] },
        })
        const written = yield* run("write", { path: file, content: "broken" })
        expect(written.status).toBe("completed")
        expect(JSON.stringify(written.content)).toContain("Language-server errors after edit")
        expect(yield* Effect.promise(() => fs.readFile(file, "utf8"))).toBe("broken")
        expect(yield* run("diagnostics", { path: file, severity: "error" })).toMatchObject({
          status: "completed",
          metadata: { total: 1, files: 1 },
          output: { diagnostics: { "source.fixture": [{ message: "fixture error" }] } },
        })
        expect(yield* run("edit", { path: file, oldString: "broken", newString: "valid" })).toMatchObject({
          status: "completed",
        })
        expect(yield* run("diagnostics", { path: file })).toMatchObject({
          status: "completed",
          output: { diagnostics: {} },
        })
        const other = path.join(location.directory, "other.fixture")
        yield* Effect.promise(() =>
          Promise.all([fs.writeFile(file, "\uFEFFsymbol\r\n"), fs.writeFile(other, "symbol\r\n")]),
        )
        yield* lsp.touchFile(file)
        yield* lsp.touchFile(other)
        expect(yield* run("lsp_references", { filePath: file, line: 1, character: 1 })).toMatchObject({
          status: "completed",
          metadata: { count: 2 },
        })
        denied = "edit"
        expect((yield* run("lsp_rename", { filePath: file, line: 1, character: 1, newName: "renamed" })).status).toBe(
          "error",
        )
        expect(yield* Effect.promise(() => fs.readFile(file, "utf8"))).toBe("\uFEFFsymbol\r\n")
        denied = ""
        expect(yield* run("lsp_rename", { filePath: file, line: 1, character: 1, newName: "renamed" })).toMatchObject({
          status: "completed",
          output: {
            edits: 2,
            files: [
              { file: "source.fixture", edits: 1 },
              { file: "other.fixture", edits: 1 },
            ],
          },
        })
        expect(yield* Effect.promise(() => fs.readFile(file, "utf8"))).toBe("\uFEFFrenamed\r\n")
        expect(yield* Effect.promise(() => fs.readFile(other, "utf8"))).toBe("renamed\r\n")
        yield* Effect.promise(() => Promise.all([fs.writeFile(file, "symbol\r\n"), fs.writeFile(other, "symbol\r\n")]))
        yield* lsp.touchFile(other)
        const outside = yield* run("lsp_rename", { filePath: file, line: 1, character: 1, newName: "outside" })
        expect(outside).toMatchObject({
          status: "completed",
          output: { edits: 2, skippedOutsideProject: [path.join(path.dirname(location.directory), "outside.fixture")] },
        })
        expect(yield* Effect.promise(() => fs.readFile(file, "utf8"))).toBe("outside\r\n")
        denied = "lsp"
        const deniedWrite = yield* run("write", { path: file, content: "broken" })
        expect(deniedWrite.status).toBe("completed")
        expect(JSON.stringify(deniedWrite.content)).not.toContain("Language-server errors")
        denied = ""
        yield* run("diagnostics", { path: file })
        expect(
          yield* run("patch", { patchText: "*** Begin Patch\n*** Delete File: source.fixture\n*** End Patch" }),
        ).toMatchObject({ status: "completed" })
        expect((yield* lsp.diagnostics())[file]).toBeUndefined()
        expect((yield* run("lsp", { operation: "hover", filePath: file, line: 1, character: 1 })).status).toBe("error")
        expect(actions).toContain("lsp")
        expect(actions).toContain("edit")
      }).pipe(
        Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(temp.path) }))),
        Effect.scoped,
      )
    }).pipe(
      Effect.provide(
        AppNodeBuilder.build(LayerNode.group([Database.node, Bus.node, Session.node, LocationServiceMap.node]), [
          Permission.node.replace(permission),
          Config.node.replace(config),
          Global.node.replace(tempGlobalLayer),
          offlineModels,
        ]),
      ),
    )
  },
)
