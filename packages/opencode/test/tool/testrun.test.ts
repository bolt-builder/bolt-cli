import { afterEach, describe, expect, test } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect, Layer } from "effect"
import { TestRunTool, parse } from "../../src/tool/testrun"
import { Config } from "@/config/config"
import { disposeAllInstances, provideInstance, testInstanceStoreLayer, tmpdirScoped } from "../fixture/fixture"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "@/tool/truncate"
import { SessionID, MessageID } from "../../src/session/schema"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Plugin } from "../../src/plugin"
import { testEffect } from "../lib/effect"
import { RuntimeFlags } from "@/effect/runtime-flags"

describe("testrun.parse", () => {
  test("parses pytest failures with file and message", () => {
    const out = [
      "collected 3 items",
      "FAILED tests/test_auth.py::test_login - AssertionError: expected 200",
      "FAILED tests/test_auth.py::test_logout",
      "1 failed, 2 passed in 0.5s",
    ].join("\n")
    const result = parse(out)
    expect(result.failures).toEqual([
      { name: "test_login", file: "tests/test_auth.py", message: "AssertionError: expected 200" },
      { name: "test_logout", file: "tests/test_auth.py" },
    ])
    expect(result.counts).toEqual({ fail: 1, pass: 2 })
  })

  test("parses go test failures", () => {
    const out = ["--- FAIL: TestDispatch (0.03s)", "    dispatch_test.go:42: budget exceeded", "FAIL"].join("\n")
    expect(parse(out).failures).toEqual([{ name: "TestDispatch" }])
  })

  test("parses cargo test failures", () => {
    const out = ["test retry::tests::exhausts_budget ... FAILED", "test result: FAILED. 1 passed; 1 failed"].join("\n")
    expect(parse(out).failures).toEqual([{ name: "retry::tests::exhausts_budget" }])
  })

  test("parses bun test failures and counts", () => {
    const out = [
      "(pass) tool.edit > replaces text [1.2ms]",
      "(fail) tool.edit > preserves BOM",
      "1 pass",
      "1 fail",
    ].join("\n")
    const result = parse(out)
    expect(result.failures).toEqual([{ name: "tool.edit > preserves BOM" }])
    expect(result.counts).toEqual({ pass: 1, fail: 1 })
  })

  test("parses jest/vitest glyph failures and TAP", () => {
    const out = ["  ✕ renders the header (12 ms)", "not ok 2 - handles empty input"].join("\n")
    const names = parse(out).failures.map((failure) => failure.name)
    expect(names).toContain("renders the header")
    expect(names).toContain("handles empty input")
  })

  test("deduplicates repeated failures", () => {
    const out = ["--- FAIL: TestX", "--- FAIL: TestX"].join("\n")
    expect(parse(out).failures).toHaveLength(1)
  })

  test("returns empty for passing output", () => {
    const result = parse("all 12 tests passed\n12 pass\n0 fail")
    expect(result.failures).toEqual([])
    expect(result.counts.fail).toBe(0)
  })
})

const layer = Layer.mergeAll(
  LayerNode.compile(
    LayerNode.group([
      CrossSpawnSpawner.node,
      FSUtil.node,
      Plugin.node,
      Truncate.node,
      Config.node,
      Agent.node,
      RuntimeFlags.node,
    ]),
  ),
  testInstanceStoreLayer,
)
const it = testEffect(layer)

afterEach(async () => {
  await disposeAllInstances()
})

const ctx = {
  sessionID: SessionID.make("ses_test-testrun"),
  messageID: MessageID.make("msg_test"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

const node = process.execPath.replaceAll("\\", "/")

describe("tool.testrun", () => {
  it.live("reports structured failures from a failing command", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* Effect.gen(function* () {
        const info = yield* TestRunTool
        const tool = yield* info.init()
        const script = "console.log('--- FAIL: TestBroken'); console.log('1 fail'); process.exit(1)"
        const result = yield* tool.execute({ command: `"${node}" -e "${script}"` }, ctx)
        expect(result.output).toContain("status=fail")
        expect(result.output).toContain("- TestBroken")
        expect(result.metadata.passed).toBe(false)
        expect(result.metadata.failureCount).toBe(1)
      }).pipe(provideInstance(dir))
    }),
  )

  it.live("reports pass for a succeeding command", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* Effect.gen(function* () {
        const info = yield* TestRunTool
        const tool = yield* info.init()
        const result = yield* tool.execute({ command: `"${node}" -e "console.log('5 pass')"` }, ctx)
        expect(result.output).toContain("status=pass")
        expect(result.metadata.passed).toBe(true)
      }).pipe(provideInstance(dir))
    }),
  )

  it.live("errors when no test command can be detected", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* Effect.gen(function* () {
        const info = yield* TestRunTool
        const tool = yield* info.init()
        const exit = yield* tool.execute({}, ctx).pipe(Effect.exit)
        expect(exit._tag).toBe("Failure")
      }).pipe(provideInstance(dir))
    }),
  )
})
