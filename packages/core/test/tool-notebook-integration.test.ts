import fs from "node:fs/promises"
import path from "node:path"
import { expect } from "bun:test"
import { Effect, Layer } from "effect"
import { FileMutation } from "@opencode/core/file-mutation"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { Environment } from "@opencode/core/environment/index"
import { Location } from "@opencode/core/location"
import { FileAccess } from "@opencode/core/file-access"
import { Permission } from "@opencode/core/permission"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { Tool } from "@opencode/core/tool"
import { NotebookTool } from "@opencode/core/tool/plugin/notebook"
import { location } from "./fixture/location"
import { withTempDir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"
import { permissionLayer } from "./lib/permission"
import { toolIdentity, executeTool, registerToolPlugin } from "./lib/tool"

const node = makeLocationNode({
  name: "test/notebook",
  layer: Layer.effectDiscard(registerToolPlugin(NotebookTool.Plugin)),
  deps: [Tool.node, FileAccess.node, FileMutation.node, Environment.node, Permission.node],
})

const original = JSON.stringify({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: { kernelspec: { name: "python3" } },
  cells: [
    {
      id: "cell-1",
      cell_type: "code",
      source: ["print(1)\n"],
      metadata: { custom: true },
      outputs: [{ output_type: "stream", text: ["1\n"] }],
      execution_count: 1,
    },
  ],
})

for (const deny of [false, true])
  testEffect(Layer.empty).live(`notebook preserves data and respects edit permission (deny=${deny})`, () =>
    withTempDir((tmp) => {
      const assertions: string[] = []
      const permission = permissionLayer({
        assert: (input) => {
          assertions.push(input.action)
          return deny && input.action === "edit"
            ? Effect.fail(
                new Permission.BlockedError({ rules: [], permission: input.action, resources: input.resources }),
              )
            : Effect.void
        },
      })
      return Effect.gen(function* () {
        const file = path.join(tmp.path, "test.ipynb")
        yield* Effect.promise(() => fs.writeFile(file, original))
        const tools = yield* Tool.Service
        const call = (input: typeof NotebookTool.Input.Type) =>
          executeTool(tools, {
            sessionID: Session.ID.make("ses_notebook"),
            ...toolIdentity,
            call: { type: "tool-call", id: "call-notebook", name: "notebook", input },
          })
        expect(yield* call({ filePath: "test.ipynb", action: "read" })).toMatchObject({
          status: "completed",
          output: { cells: 1, text: expect.stringContaining("print(1)") },
        })
        expect(assertions).toContain("read")
        expect(assertions).not.toContain("edit")
        const edited = yield* call({ filePath: "test.ipynb", action: "edit", index: 0, source: "print(2)\n" })
        expect(assertions).toContain("edit")
        if (deny) {
          expect(edited.status).not.toBe("completed")
          expect(yield* Effect.promise(() => fs.readFile(file, "utf8"))).toBe(original)
          return
        }
        expect(edited.status).toBe("completed")
        const content = JSON.parse(yield* Effect.promise(() => fs.readFile(file, "utf8")))
        expect(content.metadata.kernelspec.name).toBe("python3")
        expect(content.cells[0]).toMatchObject({
          id: "cell-1",
          source: ["print(2)\n"],
          metadata: { custom: true },
          outputs: [],
          execution_count: null,
        })
        expect(
          yield* call({ filePath: "test.ipynb", action: "insert", index: 1, cellType: "markdown", source: "# Notes" }),
        ).toMatchObject({ status: "completed", output: { cells: 2 } })
        expect(yield* call({ filePath: "test.ipynb", action: "delete", index: 0 })).toMatchObject({
          status: "completed",
          output: { cells: 1 },
        })
        expect(JSON.parse(yield* Effect.promise(() => fs.readFile(file, "utf8"))).cells[0].source).toEqual(["# Notes"])
        const before = yield* Effect.promise(() => fs.readFile(file, "utf8"))
        expect(yield* call({ filePath: "test.ipynb", action: "edit", index: 0, source: "# Notes" })).toMatchObject({
          status: "completed",
        })
        expect(yield* Effect.promise(() => fs.readFile(file, "utf8"))).toBe(before)
        expect(yield* call({ filePath: "test.ipynb", action: "delete", index: 99 })).toMatchObject({
          status: "error",
          error: { message: expect.stringContaining("99") },
        })
        expect(yield* Effect.promise(() => fs.readFile(file, "utf8"))).toBe(before)
      }).pipe(
        Effect.provide(
          AppNodeBuilder.build(LayerNode.group([Tool.node, FileAccess.node, FileMutation.node, node]), [
            Location.node.replace(
              Layer.succeed(
                Location.Service,
                Location.Service.of(location({ directory: AbsolutePath.make(tmp.path) })),
              ),
            ),
            Permission.node.replace(permission),
          ]),
        ),
      )
    }),
  )
