import { $ } from "bun"
import { initRepo } from "./fixture/git"
import { GitTool } from "@opencode/core/tool/plugin/git"
import { describe, expect } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Effect, Layer } from "effect"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Environment } from "@opencode/core/environment/index"
import { FileSystem } from "@opencode/core/filesystem"
import { Location } from "@opencode/core/location"
import { FileAccess } from "@opencode/core/file-access"
import { Permission } from "@opencode/core/permission"
import { Ripgrep } from "@opencode/core/ripgrep"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { GlobTool } from "@opencode/core/tool/plugin/glob"
import { SemanticSearchTool } from "@opencode/core/tool/plugin/semantic-search"
import { GrepTool } from "@opencode/core/tool/plugin/grep"
import { Tool } from "@opencode/core/tool"
import { location } from "./fixture/location"
import { tmpdir, tmpdirScoped } from "./fixture/tmpdir"
import { it } from "./lib/effect"
import { permissionLayer } from "./lib/permission"
import { executeTool, registerToolPlugin, toolIdentity } from "./lib/tool"

const globToolNode = makeLocationNode({
  name: "test/glob-tool-plugin",
  layer: Layer.effectDiscard(registerToolPlugin(GlobTool.Plugin)),
  deps: [Tool.node, Environment.node, Ripgrep.node, Location.node, FileAccess.node, Permission.node],
})
const grepToolNode = makeLocationNode({
  name: "test/grep-tool-plugin",
  layer: Layer.effectDiscard(registerToolPlugin(GrepTool.Plugin)),
  deps: [Tool.node, Environment.node, Ripgrep.node, Location.node, FileAccess.node, Permission.node],
})
const semanticToolNode = makeLocationNode({
  name: "test/semantic-search-tool-plugin",
  layer: Layer.effectDiscard(registerToolPlugin(SemanticSearchTool.Plugin)),
  deps: [Tool.node, Environment.node, Ripgrep.node, Location.node, FileAccess.node, Permission.node],
})
const gitToolNode = makeLocationNode({
  name: "test/git-tool-plugin",
  layer: Layer.effectDiscard(registerToolPlugin(GitTool.Plugin)),
  deps: [Tool.node, Environment.node, Location.node, FileAccess.node, Permission.node],
})
const sessionID = Session.ID.make("ses_search_tool_test")

const withTools = <A, E, R>(
  directory: string,
  body: (registry: Tool.Interface) => Effect.Effect<A, E, R>,
  assertions?: Permission.AssertInput[],
) =>
  Effect.gen(function* () {
    const registry = yield* Tool.Service
    return yield* body(registry)
  }).pipe(
    Effect.provide(
      AppNodeBuilder.build(LayerNode.group([Tool.node, globToolNode, grepToolNode, semanticToolNode, gitToolNode]), [
        Location.node.replace(
          Layer.succeed(Location.Service, Location.Service.of(location({ directory: AbsolutePath.make(directory) }))),
        ),
        Permission.node.replace(
          permissionLayer({
            assert: (input) =>
              Effect.sync(() => {
                assertions?.push(input)
              }),
          }),
        ),
      ]),
    ),
  )

const call = (name: "glob" | "grep" | "semantic_search" | "git", input: unknown) => ({
  sessionID,
  ...toolIdentity,
  call: { type: "tool-call" as const, id: `call-${name}`, name, input },
})

describe("search tools", () => {
  for (const hidden of [undefined, false, true]) {
    for (const limit of hidden ? [10] : [1, 10]) {
      it.live(`glob honors hidden=${hidden} before limit=${limit}`, () =>
        Effect.gen(function* () {
          const tmp = yield* tmpdirScoped()
          yield* Effect.promise(() =>
            Promise.all(
              ["src/visible.ts", ".hidden.ts", "src/.hidden.ts", ".hidden/nested.ts", ".git/config.ts"].map((file) =>
                Bun.write(path.join(tmp.path, file), "needle\n"),
              ),
            ),
          )
          yield* withTools(tmp.path, (registry) =>
            Effect.gen(function* () {
              const result = yield* executeTool(
                registry,
                call("glob", { pattern: "**/*.ts", limit, ...(hidden === undefined ? {} : { hidden }) }),
              )
              const expected = hidden
                ? [".hidden.ts", ".hidden/nested.ts", "src/.hidden.ts", "src/visible.ts"]
                : ["src/visible.ts"]

              expect(result.status).toBe("completed")
              expect(result.output).toHaveLength(expected.length)
              expect(result.output).toEqual(
                expect.arrayContaining(expected.map((file) => ({ path: path.normalize(file), type: "file" }))),
              )
              expect(result.metadata).toEqual({ count: expected.length, truncated: false })
              expect(result.content).toHaveLength(1)
              expect(result.content?.[0]?.type === "text" ? result.content[0].text.split("\n").sort() : []).toEqual(
                expected.map((file) => path.join(tmp.path, file)).sort(),
              )
            }),
          )
        }),
      )
    }
  }

  it.live("bounds omitted glob and grep limits", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            Promise.all(
              Array.from({ length: FileSystem.DEFAULT_SEARCH_LIMIT + 1 }, (_, index) =>
                fs.writeFile(path.join(tmp.path, `${index}.txt`), "needle\n"),
              ),
            ),
          )
          yield* withTools(tmp.path, (registry) =>
            Effect.gen(function* () {
              const glob = yield* executeTool(registry, call("glob", { pattern: "*" }))
              const grep = yield* executeTool(registry, call("grep", { pattern: "needle" }))

              expect(glob.metadata).toEqual({ count: FileSystem.DEFAULT_SEARCH_LIMIT, truncated: true })
              expect(grep.metadata).toEqual({ matches: FileSystem.DEFAULT_SEARCH_LIMIT, truncated: true })
              expect(glob.content).toHaveLength(1)
              expect(grep.content).toHaveLength(1)
              const globText = glob.content?.[0]?.type === "text" ? glob.content[0].text : ""
              const grepText = grep.content?.[0]?.type === "text" ? grep.content[0].text : ""
              expect(globText.split("\n")).toHaveLength(FileSystem.DEFAULT_SEARCH_LIMIT + 2)
              expect(globText).toEndWith(
                `(Results are truncated: showing first ${FileSystem.DEFAULT_SEARCH_LIMIT} results. Consider using a more specific path or pattern.)`,
              )
              expect(grepText).toStartWith(`Found ${FileSystem.DEFAULT_SEARCH_LIMIT} matches\n`)
              expect(grepText).toEndWith(
                `(Results are truncated: showing first ${FileSystem.DEFAULT_SEARCH_LIMIT} results. Consider using a more specific path or pattern.)`,
              )
            }),
          )
        }),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("rejects an empty grep pattern", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        withTools(tmp.path, (registry) =>
          Effect.gen(function* () {
            expect(yield* executeTool(registry, call("grep", { pattern: "" }))).toEqual({
              status: "error",
              error: {
                type: "tool.execution",
                message:
                  'Invalid arguments for tool "grep":\n- pattern: Pattern must not be empty\n\nArguments provided:\n{\n  "pattern": ""\n}\n\nUpdate the arguments and call the tool again.',
              },
            })
          }),
        ),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("handles explicit grep file and directory paths", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.promise(() =>
          Promise.all([
            fs.writeFile(path.join(tmp.path, "target.txt"), "needle\n"),
            fs.writeFile(path.join(tmp.path, "other.txt"), "needle\n"),
          ]),
        ).pipe(
          Effect.andThen(
            withTools(tmp.path, (registry) =>
              Effect.gen(function* () {
                const file = yield* executeTool(registry, call("grep", { path: "target.txt", pattern: "needle" }))
                expect(file).toMatchObject({
                  status: "completed",
                  output: [{ entry: { path: "target.txt" }, line: 1, text: "needle\n" }],
                  metadata: { matches: 1, truncated: false },
                })

                const directory = yield* executeTool(registry, call("grep", { path: ".", pattern: "needle" }))
                expect(directory).toMatchObject({
                  status: "completed",
                  metadata: { matches: 2, truncated: false },
                })
                if (directory.status !== "completed") return
                expect(directory.output).toEqual(
                  expect.arrayContaining([
                    expect.objectContaining({ entry: expect.objectContaining({ path: "target.txt" }) }),
                    expect.objectContaining({ entry: expect.objectContaining({ path: "other.txt" }) }),
                  ]),
                )
              }),
            ),
          ),
        ),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("reports no grep matches", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.promise(() => fs.writeFile(path.join(tmp.path, "file.txt"), "haystack\n")).pipe(
          Effect.andThen(withTools(tmp.path, (registry) => executeTool(registry, call("grep", { pattern: "needle" })))),
          Effect.tap((result) =>
            Effect.sync(() => {
              expect(result).toMatchObject({
                status: "completed",
                content: [{ type: "text", text: "No matches found" }],
                metadata: { matches: 0, truncated: false },
              })
            }),
          ),
        ),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("reports invalid grep regex details", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        withTools(tmp.path, (registry) =>
          Effect.gen(function* () {
            const result = yield* executeTool(registry, call("grep", { pattern: "[" }))
            expect(result).toMatchObject({
              status: "error",
              error: { type: "tool.execution" },
            })
            if (result.status !== "error" || !result.error) return
            expect(result.error.message).toStartWith("Invalid regex pattern:")
            expect(result.error.message).toContain("unclosed character class")
          }),
        ),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("requires external_directory approval for external grep files and directories", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => Promise.all([tmpdir(), tmpdir()])),
      ([active, outside]) => {
        const assertions: Permission.AssertInput[] = []
        return Effect.promise(() => fs.writeFile(path.join(outside.path, "outside.txt"), "needle\n")).pipe(
          Effect.andThen(
            withTools(
              active.path,
              (registry) =>
                Effect.gen(function* () {
                  const directory = yield* executeTool(
                    registry,
                    call("grep", { path: outside.path, pattern: "needle" }),
                  )
                  const file = yield* executeTool(
                    registry,
                    call("grep", { path: path.join(outside.path, "outside.txt"), pattern: "needle" }),
                  )
                  expect(directory.status).toBe("completed")
                  expect(file.status).toBe("completed")
                }),
              assertions,
            ),
          ),
          Effect.tap(() =>
            Effect.sync(() => {
              expect(assertions.map((input) => input.action)).toEqual([
                "external_directory",
                "grep",
                "external_directory",
                "grep",
              ])
              expect(assertions[0]?.resources).toEqual([path.join(outside.path, "*").replaceAll("\\", "/")])
              expect(assertions[2]?.resources).toEqual([path.join(outside.path, "*").replaceAll("\\", "/")])
            }),
          ),
        )
      },
      ([active, outside]) =>
        Effect.promise(() =>
          Promise.all([active[Symbol.asyncDispose](), outside[Symbol.asyncDispose]()]).then(() => undefined),
        ),
    ),
  )

  for (const name of ["glob", "grep"] as const) {
    it.live(`${name} reports a missing search path`, () =>
      Effect.acquireUseRelease(
        Effect.promise(() => tmpdir()),
        (tmp) =>
          withTools(tmp.path, (registry) =>
            Effect.gen(function* () {
              const result = yield* executeTool(
                registry,
                call(name, { path: "missing", pattern: name === "glob" ? "*" : "needle" }),
              )
              expect(result).toEqual({
                status: "error",
                error: { type: "tool.execution", message: "Search path does not exist: missing" },
              })
            }),
          ),
        (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
      ),
    )
  }

  it.live("reports a file used as the glob search path", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.promise(() => fs.writeFile(path.join(tmp.path, "file.txt"), "content\n")).pipe(
          Effect.andThen(
            withTools(tmp.path, (registry) => executeTool(registry, call("glob", { path: "file.txt", pattern: "*" }))),
          ),
          Effect.tap((result) =>
            Effect.sync(() => {
              expect(result).toEqual({
                status: "error",
                error: { type: "tool.execution", message: "Search path is not a directory: file.txt" },
              })
            }),
          ),
        ),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("requires external_directory approval for an explicit external glob path", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => Promise.all([tmpdir(), tmpdir()])),
      ([active, outside]) => {
        const assertions: Permission.AssertInput[] = []
        return Effect.promise(() => fs.writeFile(path.join(outside.path, "outside.txt"), "outside\n")).pipe(
          Effect.andThen(
            withTools(
              active.path,
              (registry) => executeTool(registry, call("glob", { path: outside.path, pattern: "*.txt" })),
              assertions,
            ),
          ),
          Effect.tap((result) =>
            Effect.sync(() => {
              expect(result.status).toBe("completed")
              expect(assertions.map((input) => input.action)).toEqual(["external_directory", "glob"])
              expect(assertions[0]?.resources).toEqual([path.join(outside.path, "*").replaceAll("\\", "/")])
            }),
          ),
        )
      },
      ([active, outside]) =>
        Effect.promise(() =>
          Promise.all([active[Symbol.asyncDispose](), outside[Symbol.asyncDispose]()]).then(() => undefined),
        ),
    ),
  )

  it.live("globs through an in-location external symlink without external approval", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => Promise.all([tmpdir(), tmpdir()])),
      ([active, outside]) => {
        if (process.platform === "win32") return Effect.void
        const assertions: Permission.AssertInput[] = []
        return Effect.promise(async () => {
          await fs.writeFile(path.join(outside.path, "outside.txt"), "outside\n")
          await fs.symlink(outside.path, path.join(active.path, "linked"))
        }).pipe(
          Effect.andThen(
            withTools(
              active.path,
              (registry) => executeTool(registry, call("glob", { path: "linked", pattern: "*.txt" })),
              assertions,
            ),
          ),
          Effect.tap((result) =>
            Effect.sync(() => {
              expect(result.status).toBe("completed")
              expect(assertions.map((input) => input.action)).toEqual(["glob"])
              expect(result).toMatchObject({
                output: [{ path: path.join("linked", "outside.txt"), type: "file" }],
                content: [{ type: "text", text: path.join(active.path, "linked", "outside.txt") }],
              })
            }),
          ),
        )
      },
      ([active, outside]) =>
        Effect.promise(() =>
          Promise.all([active[Symbol.asyncDispose](), outside[Symbol.asyncDispose]()]).then(() => undefined),
        ),
    ),
  )
})

describe("Bolt semantic search", () => {
  it.live("ranks source definitions, bounds results and records V2 read permissions", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped()
      yield* Effect.promise(() =>
        Promise.all([
          Bun.write(path.join(tmp.path, ".ignore"), "node_modules/\n"),
          Bun.write(path.join(tmp.path, "cache.ts"), "export function invalidateCache() { return expiredEntries() }\n"),
          Bun.write(path.join(tmp.path, "unrelated.ts"), "export function formatInvoice() { return printInvoice() }\n"),
          Bun.write(path.join(tmp.path, "node_modules", "ignored.ts"), "export function invalidateCache() {}\n"),
        ]),
      )
      const assertions: Permission.AssertInput[] = []
      yield* withTools(
        tmp.path,
        (registry) =>
          Effect.gen(function* () {
            const result = yield* executeTool(
              registry,
              call("semantic_search", { query: "invalidate cache", limit: 1 }),
            )
            expect(result.status).toBe("completed")
            expect(result.output).toHaveLength(1)
            expect(result.output[0]).toMatchObject({ file: "cache.ts", start: 1 })
            expect(result.metadata).toMatchObject({ files: 2, results: 1 })
            expect(result.content?.[0]?.type === "text" ? result.content[0].text : "").toContain("invalidateCache")
            expect(assertions[0]).toMatchObject({
              action: "semantic_search",
              resources: ["invalidate cache"],
              sessionID,
              agent: toolIdentity.agent,
              source: { type: "tool", messageID: toolIdentity.messageID, id: "call-semantic_search" },
            })
            expect(
              assertions
                .filter((input) => input.action === "read")
                .map((input) => input.resources)
                .flat()
                .sort(),
            ).toEqual(["cache.ts", "unrelated.ts"])
          }),
        assertions,
      )
    }),
  )

  it.live("returns the original no-match guidance and rejects empty queries", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped()
      yield* Effect.promise(() => Bun.write(path.join(tmp.path, "empty.ts"), "const value = 1\n"))
      yield* withTools(tmp.path, (registry) =>
        Effect.gen(function* () {
          const result = yield* executeTool(registry, call("semantic_search", { query: "invoices" }))
          expect(result.status).toBe("completed")
          expect(result.output).toEqual([])
          expect(result.content).toEqual([
            { type: "text", text: "No matching code found. Try different wording, or grep for exact strings." },
          ])
          const invalid = yield* executeTool(registry, call("semantic_search", { query: "" }))
          expect(invalid.status).toBe("error")
        }),
      )
    }),
  )
})

describe("Bolt git query tool", () => {
  it.live("runs original read-only queries with canonical permissions and rejects revision options", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped()
      yield* Effect.promise(async () => {
        await initRepo(tmp.path)
        await Bun.write(path.join(tmp.path, "file.txt"), "first\n")
        await $`git add file.txt`.cwd(tmp.path).quiet()
        await $`git commit -m fixture`.cwd(tmp.path).quiet()
        await Bun.write(path.join(tmp.path, "file.txt"), "second\n")
        await Bun.write(path.join(tmp.path, "new.txt"), "untracked\n")
      })
      const assertions: Permission.AssertInput[] = []
      yield* withTools(
        tmp.path,
        (registry) =>
          Effect.gen(function* () {
            const status = yield* executeTool(registry, call("git", { action: "status" }))
            expect(status.status).toBe("completed")
            expect(status.output).toContain("modified file.txt")
            expect(status.output).toContain("untracked:")
            expect(status.metadata).toMatchObject({ title: "git status", unstaged: 1, untracked: 1 })
            const patch = yield* executeTool(registry, call("git", { action: "diff", path: "file.txt" }))
            expect(patch.output).toContain("+second")
            expect(patch.metadata).toMatchObject({ files: 1, additions: 1, deletions: 1 })
            const staged = yield* executeTool(registry, call("git", { action: "diff", staged: true }))
            expect(staged.output).toBe("no changes")
            const log = yield* executeTool(registry, call("git", { action: "log", count: 1 }))
            expect(log.output).toContain("fixture")
            const blame = yield* executeTool(
              registry,
              call("git", { action: "blame", path: "file.txt", start: 1, end: 1 }),
            )
            expect(blame.output).toContain("second")
            const show = yield* executeTool(registry, call("git", { action: "show", sha: "HEAD" }))
            expect(show.output).toContain("subject fixture")
            expect(show.output).toContain("+first")
            const injected = yield* executeTool(
              registry,
              call("git", { action: "show", sha: `--output=${path.join(tmp.path, "written.txt")}` }),
            )
            expect(injected.status).toBe("error")
            expect(yield* Effect.promise(() => Bun.file(path.join(tmp.path, "written.txt")).exists())).toBe(false)
            expect((yield* executeTool(registry, call("git", { action: "blame" }))).status).toBe("error")
            expect(assertions.filter((item) => item.action === "git").map((item) => item.resources)).toEqual([
              ["status"],
              ["diff"],
              ["diff"],
              ["log"],
              ["blame"],
              ["show"],
              ["show"],
              ["blame"],
            ])
            expect(assertions[0]?.source).toEqual({ type: "tool", messageID: toolIdentity.messageID, id: "call-git" })
          }),
        assertions,
      )
    }),
  )
})
