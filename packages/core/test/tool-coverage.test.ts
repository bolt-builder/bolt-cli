import { describe, expect, test } from "bun:test"
import { pattern, relevant, render } from "@opencode/core/tool/plugin/coverage"

describe("pattern", () => {
  test("builds the conventional test pattern for a source file", () => {
    expect(pattern("src/cli/cmd/review.ts")).toBe("**/{review.test,review.spec,review_test,test_review}.*")
  })

  test("uses the basename without its extension", () => {
    expect(pattern("pkg/util/glob.go")).toBe("**/{glob.test,glob.spec,glob_test,test_glob}.*")
  })

  test("returns undefined for an empty basename", () => {
    expect(pattern("")).toBeUndefined()
  })
})

describe("relevant", () => {
  test("drops node_modules and .git matches", () => {
    const matches = [
      "test/cli/review.test.ts",
      "node_modules/pkg/review.test.ts",
      ".git/review.test.ts",
      "packages/opencode/test/review.spec.ts",
    ]
    expect(relevant(matches)).toEqual(["test/cli/review.test.ts", "packages/opencode/test/review.spec.ts"])
  })

  test("handles windows separators", () => {
    expect(relevant(["node_modules\\pkg\\review.test.ts"])).toEqual([])
  })
})

describe("render", () => {
  test("reports covered and untested files with guidance", () => {
    const output = render([
      { file: "src/a.ts", tests: ["test/a.test.ts"] },
      { file: "src/b.ts", tests: [] },
    ])
    expect(output).toContain("1/2 files have tests.")
    expect(output).toContain("covered src/a.ts (1 test file)")
    expect(output).toContain("  test/a.test.ts")
    expect(output).toContain("untested src/b.ts")
    expect(output).toContain("Prefer changes in covered files.")
  })

  test("pluralizes test file counts", () => {
    const output = render([{ file: "src/a.ts", tests: ["test/a.test.ts", "test/a.spec.ts"] }])
    expect(output).toContain("covered src/a.ts (2 test files)")
  })
})

import { Effect, Layer } from "effect"
import { CoverageTool } from "@opencode/core/tool/plugin/coverage"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Location } from "@opencode/core/location"
import { Environment } from "@opencode/core/environment/index"
import { FileAccess } from "@opencode/core/file-access"
import { Permission } from "@opencode/core/permission"
import { Ripgrep } from "@opencode/core/ripgrep"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { Tool } from "@opencode/core/tool"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { location } from "./fixture/location"
import { tmpdirScoped } from "./fixture/tmpdir"
import { permissionLayer } from "./lib/permission"
import { testEffect } from "./lib/effect"
import { executeTool, registerToolPlugin, toolIdentity } from "./lib/tool"
import fs from "node:fs/promises"
import path from "node:path"

const coverageNode = makeLocationNode({
  name: "test/coverage",
  layer: Layer.effectDiscard(registerToolPlugin(CoverageTool.Plugin)),
  deps: [Tool.node, FileAccess.node, Environment.node, Location.node, Permission.node, Ripgrep.node],
})
const it = testEffect(Layer.empty)
it.live("coverage finds real conventional tests, reports missing files and honors read/search approvals", () =>
  Effect.gen(function* () {
    const temp = yield* tmpdirScoped()
    for (const file of ["src/a.ts", "src/b.ts", "test/a.test.ts", "test/a.spec.ts", "node_modules/pkg/a.test.ts"])
      yield* Effect.promise(async () => {
        await fs.mkdir(path.dirname(path.join(temp.path, file)), { recursive: true })
        await Bun.write(path.join(temp.path, file), "fixture\n")
      })
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
    })
    yield* Effect.gen(function* () {
      const tools = yield* Tool.Service
      const run = (files: string[]) =>
        executeTool(tools, {
          sessionID: Session.ID.make("ses_coverage"),
          ...toolIdentity,
          call: { type: "tool-call", id: "coverage", name: "coverage", input: { files } },
          progress: () => Effect.void,
        })
      const result = yield* run(["src/a.ts", "src/b.ts"])
      expect(result.status).toBe("completed")
      expect(result.output).toEqual({
        entries: [
          { file: "src/a.ts", tests: ["test/a.spec.ts", "test/a.test.ts"] },
          { file: "src/b.ts", tests: [] },
        ],
        truncated: false,
      })
      expect(result.metadata).toMatchObject({ covered: 1, untested: 1 })
      expect(actions).toContain("read")
      expect(actions).toContain("glob")
      const missing = yield* run(["src/missing.ts"])
      expect(missing.status).toBe("error")
      denied = "glob"
      expect((yield* run(["src/a.ts"])).status).toBe("error")
      denied = "read"
      expect((yield* run(["src/a.ts"])).status).toBe("error")
    }).pipe(
      Effect.provide(
        AppNodeBuilder.build(LayerNode.group([Tool.node, coverageNode]), [
          Location.node.replace(Layer.succeed(Location.Service, location({ directory: AbsolutePath.make(temp.path) }))),
          Permission.node.replace(permission),
        ]),
      ),
    )
  }),
)
