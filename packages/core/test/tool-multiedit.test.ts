import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Effect, Layer } from "effect"
import { Location } from "@opencode/core/location"
import { Plugin } from "@opencode/core/plugin"
import { Permission } from "@opencode/core/permission"
import { Session } from "@opencode/core/session"
import { Tool } from "@opencode/core/tool"
import { MultiEditTool } from "@opencode/core/tool/plugin/multiedit"
import { testEffect } from "./lib/effect"
import { executeTool, toolIdentity } from "./lib/tool"
import { permissionLayer } from "./lib/permission"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Database } from "@opencode/core/database/database"
import { Bus } from "@opencode/core/bus"
import { LocationServiceMap } from "@opencode/core/location-service-map"
import { AbsolutePath } from "@opencode/core/schema"
import { Global } from "@opencode/util/global"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { tempGlobalLayer } from "./fixture/global"
import { offlineModels } from "./fixture/models"
import { tmpdirScoped } from "./fixture/tmpdir"

const apply = MultiEditTool.apply
describe("multiedit atomic preparation", () => {
  test("applies in order, including matches created by an earlier edit", () => {
    expect(
      apply("value = 1\n", [
        { oldString: "value = 1", newString: "count = 1" },
        { oldString: "count = 1", newString: "count = 2" },
      ]),
    ).toEqual({ content: "count = 2\n", replacements: 2 })
  })
  test("requires a unique match unless replaceAll is set", () => {
    expect(() => apply("a a", [{ oldString: "a", newString: "b" }])).toThrow("2 matches")
    expect(apply("a a", [{ oldString: "a", newString: "b", replaceAll: true }]).content).toBe("b b")
  })
  test("reports the failing edit while leaving the source untouched", () => {
    const source = "alpha\nbeta\n"
    expect(() =>
      apply(source, [
        { oldString: "alpha", newString: "one" },
        { oldString: "missing", newString: "two" },
      ]),
    ).toThrow("Edit 2 of 2 failed, no changes applied")
    expect(source).toBe("alpha\nbeta\n")
  })
  test("preserves CRLF and supports explicit line-ending edits", () => {
    expect(apply("a\r\nb\r\n", [{ oldString: "a\nb", newString: "x\ny" }]).content).toBe("x\r\ny\r\n")
    expect(apply("a\r\nb", [{ oldString: "a\r\n", newString: "a\n" }]).content).toBe("a\nb")
  })
  test("rejects empty and identical replacements", () => {
    expect(() => apply("a", [{ oldString: "", newString: "b" }])).toThrow("nonempty")
    expect(() => apply("a", [{ oldString: "a", newString: "a" }])).toThrow("differ")
  })
})

testEffect(Layer.empty).live(
  "registered multiedit requires a real prior read, preserves atomicity/BOM and respects edit denial",
  () => {
    let denied = ""
    const actions: string[] = []
    const permission = permissionLayer({
      close: Effect.void,
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
      assertNotDenied: () => Effect.void,
      allows: () => Effect.succeed(false),
    })
    return Effect.gen(function* () {
      const temp = yield* tmpdirScoped()
      const locations = yield* LocationServiceMap.Service
      yield* Effect.gen(function* () {
        const plugins = yield* Plugin.Service
        yield* plugins.awaitActivation
        const location = yield* Location.Service
        const tools = yield* Tool.Service
        const sessions = yield* Session.Service
        const session = yield* sessions.create({
          location: { directory: location.directory },
          agent: toolIdentity.agent,
        })
        const target = path.join(location.directory, "multi.txt")
        const original = "\uFEFFalpha\r\nbeta\r\n"
        yield* Effect.promise(() => fs.writeFile(target, original))
        const run = (name: string, input: Record<string, unknown>, sessionID = session.id) =>
          executeTool(tools, {
            sessionID,
            ...toolIdentity,
            call: { type: "tool-call", id: "call-multi", name, input },
            progress: () => Effect.void,
          })
        const edits = [
          { oldString: "alpha", newString: "one" },
          { oldString: "beta", newString: "two" },
        ]
        expect(yield* run("multiedit", { filePath: target, edits })).toMatchObject({
          status: "error",
          error: { message: expect.stringContaining("Read this file") },
        })
        expect(yield* Effect.promise(() => fs.readFile(target, "utf8"))).toBe(original)
        expect(yield* run("read", { path: target })).toMatchObject({ status: "completed" })
        const invalid = yield* run("multiedit", {
          filePath: target,
          edits: [edits[0], { oldString: "missing", newString: "three" }],
        })
        expect(invalid).toMatchObject({
          status: "error",
          error: { message: expect.stringContaining("Edit 2 of 2 failed") },
        })
        expect(yield* Effect.promise(() => fs.readFile(target, "utf8"))).toBe(original)
        denied = "edit"
        expect((yield* run("multiedit", { filePath: target, edits })).status).toBe("error")
        expect(yield* Effect.promise(() => fs.readFile(target, "utf8"))).toBe(original)
        denied = ""
        const success = yield* run("multiedit", { filePath: target, edits })
        expect(success.status).toBe("completed")
        expect(success.metadata).toMatchObject({ files: [{ file: "multi.txt", additions: 2, deletions: 2 }] })
        expect(yield* Effect.promise(() => fs.readFile(target, "utf8"))).toBe("\uFEFFone\r\ntwo\r\n")
        const other = yield* sessions.create({ location: { directory: location.directory }, agent: toolIdentity.agent })
        expect(
          (yield* run("multiedit", { filePath: target, edits: [{ oldString: "one", newString: "three" }] }, other.id))
            .status,
        ).toBe("error")
        expect(actions).toContain("read")
        expect(actions).toContain("edit")
      }).pipe(
        Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(temp.path) }))),
        Effect.scoped,
      )
    }).pipe(
      Effect.provide(
        AppNodeBuilder.build(LayerNode.group([Database.node, Bus.node, Session.node, LocationServiceMap.node]), [
          Permission.node.replace(permission),
          Global.node.replace(tempGlobalLayer),
          offlineModels,
        ]),
      ),
    )
  },
)
