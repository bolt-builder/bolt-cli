import { afterEach, describe, expect } from "bun:test"
import path from "path"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Cause, Effect, Exit } from "effect"
import { MultiEditTool } from "../../src/tool/multiedit"
import { disposeAllInstances } from "../fixture/fixture"
import { LSP } from "@/lsp/lsp"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Format } from "../../src/format"
import { Agent } from "../../src/agent/agent"
import { EventV2Bridge } from "../../src/event-v2-bridge"
import { Truncate } from "@/tool/truncate"
import { SessionID, MessageID } from "../../src/session/schema"
import * as Tool from "../../src/tool/tool"
import { testEffect } from "../lib/effect"
import { InstanceState } from "@/effect/instance-state"

const ctx = {
  sessionID: SessionID.make("ses_test-multiedit-session"),
  messageID: MessageID.make("msg_test"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

afterEach(async () => {
  await disposeAllInstances()
})

const layer = LayerNode.compile(
  LayerNode.group([LSP.node, FSUtil.node, Format.node, EventV2Bridge.node, Truncate.node, Agent.node]),
)

const it = testEffect(layer)

const run = Effect.fn("MultiEditToolTest.run")(function* (args: Tool.InferParameters<typeof MultiEditTool>) {
  const info = yield* MultiEditTool
  const tool = yield* info.init()
  return yield* tool.execute(args, ctx)
})

const fail = Effect.fn("MultiEditToolTest.fail")(function* (args: Tool.InferParameters<typeof MultiEditTool>) {
  const exit = yield* run(args).pipe(Effect.exit)
  if (Exit.isFailure(exit)) {
    const err = Cause.squash(exit.cause)
    return err instanceof Error ? err : new Error(String(err))
  }
  throw new Error("expected multiedit to fail")
})

const put = Effect.fn("MultiEditToolTest.put")(function* (p: string, content: string) {
  const fs = yield* FSUtil.Service
  yield* fs.writeWithDirs(p, content)
})

const load = Effect.fn("MultiEditToolTest.load")(function* (p: string) {
  const fs = yield* FSUtil.Service
  return yield* fs.readFileString(p)
})

const file = Effect.fn("MultiEditToolTest.file")(function* (name: string) {
  const dir = yield* InstanceState.directory
  return path.join(dir, name)
})

describe("tool.multiedit", () => {
  it.instance("applies several edits in order", () =>
    Effect.gen(function* () {
      const p = yield* file("multi.txt")
      yield* put(p, "alpha\nbeta\ngamma\n")
      const result = yield* run({
        filePath: p,
        edits: [
          { oldString: "alpha", newString: "one" },
          { oldString: "beta", newString: "two" },
          { oldString: "gamma", newString: "three" },
        ],
      })
      expect(yield* load(p)).toBe("one\ntwo\nthree\n")
      expect(result.output).toContain("Applied 3 edits")
    }),
  )

  it.instance("later edits see the result of earlier edits", () =>
    Effect.gen(function* () {
      const p = yield* file("chain.txt")
      yield* put(p, "value = 1\n")
      yield* run({
        filePath: p,
        edits: [
          { oldString: "value = 1", newString: "count = 1" },
          { oldString: "count = 1", newString: "count = 2" },
        ],
      })
      expect(yield* load(p)).toBe("count = 2\n")
    }),
  )

  it.instance("supports replaceAll per edit", () =>
    Effect.gen(function* () {
      const p = yield* file("all.txt")
      yield* put(p, "foo foo foo\nbar\n")
      yield* run({
        filePath: p,
        edits: [
          { oldString: "foo", newString: "baz", replaceAll: true },
          { oldString: "bar", newString: "qux" },
        ],
      })
      expect(yield* load(p)).toBe("baz baz baz\nqux\n")
    }),
  )

  it.instance("is atomic: a failing edit leaves the file untouched", () =>
    Effect.gen(function* () {
      const p = yield* file("atomic.txt")
      yield* put(p, "alpha\nbeta\n")
      const err = yield* fail({
        filePath: p,
        edits: [
          { oldString: "alpha", newString: "one" },
          { oldString: "does-not-exist", newString: "two" },
        ],
      })
      expect(err.message).toContain("Edit 2 of 2 failed")
      expect(yield* load(p)).toBe("alpha\nbeta\n")
    }),
  )

  it.instance("rejects an empty edits array", () =>
    Effect.gen(function* () {
      const p = yield* file("empty.txt")
      yield* put(p, "alpha\n")
      const err = yield* fail({ filePath: p, edits: [] })
      expect(err.message).toContain("at least one edit")
    }),
  )

  it.instance("rejects missing files", () =>
    Effect.gen(function* () {
      const p = yield* file("missing.txt")
      const err = yield* fail({ filePath: p, edits: [{ oldString: "a", newString: "b" }] })
      expect(err.message).toContain("not found")
    }),
  )

  it.instance("preserves CRLF line endings", () =>
    Effect.gen(function* () {
      const p = yield* file("crlf.txt")
      yield* put(p, "alpha\r\nbeta\r\n")
      yield* run({
        filePath: p,
        edits: [{ oldString: "alpha\nbeta", newString: "one\ntwo" }],
      })
      expect(yield* load(p)).toBe("one\r\ntwo\r\n")
    }),
  )
})
