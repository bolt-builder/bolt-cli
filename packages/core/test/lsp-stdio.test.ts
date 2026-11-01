import { describe, expect, test } from "bun:test"
import path from "node:path"
import { Deferred, Duration, Effect, Exit, Fiber, Schema } from "effect"
import { TestClock } from "effect/testing"
import { LspStdio } from "@opencode/core/lsp/stdio"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Environment } from "@opencode/core/environment/index"
import { Location } from "@opencode/core/location"
import { tempLocationLayer } from "./fixture/location"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { testEffect } from "./lib/effect"

const message = { jsonrpc: "2.0" as const, id: 1, result: "β🔥 中文" }
describe("LSP byte framing", () => {
  test("handles every byte split, coalesced messages and UTF-8 boundaries", () => {
    const bytes = LspStdio.encode(message)
    for (let split = 0; split <= bytes.length; split++) {
      const reader = new LspStdio.Reader()
      expect([...reader.push(bytes.subarray(0, split)), ...reader.push(bytes.subarray(split))]).toEqual([message])
      reader.end()
    }
    const reader = new LspStdio.Reader()
    const output = [...Buffer.concat([bytes, bytes])].flatMap((byte) => reader.push(Uint8Array.of(byte)))
    expect(output).toEqual([message, message])
    reader.end()
  })
  test("rejects ambiguous, invalid, oversized and incomplete frames", () => {
    for (const header of [
      "Content-Length: -1",
      "Content-Length: 0",
      "Content-Length: nope",
      "Content-Length: 16777217",
      "Content-Length: 2\r\nContent-Length: 2",
      "Unknown: 2",
    ])
      expect(() => new LspStdio.Reader().push(Buffer.from(header + "\r\n\r\n"))).toThrow()
    expect(() => new LspStdio.Reader().push(Buffer.from("x".repeat(8193)))).toThrow("headers exceed")
    const reader = new LspStdio.Reader()
    reader.push(Buffer.from("Content-Length: 10\r\n\r\n{}"))
    expect(() => reader.end()).toThrow("incomplete")
    expect(() => new LspStdio.Reader().push(Buffer.from("Content-Length: 2\r\n\r\n{}"))).toThrow()
  })
})
const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([Environment.node, Location.node]), [Location.node.replace(tempLocationLayer)]),
)
const command = [process.execPath, path.join(import.meta.dir, "fixture/lsp-server.ts")]
it.live("LSP stdio correlates concurrent responses, answers server requests and rejects closed connections", () =>
  Effect.gen(function* () {
    const location = yield* Location.Service
    const connection = yield* LspStdio.make({
      command,
      directory: location.directory,
      notification: () => Effect.void,
      request: () => Effect.succeed({ configured: true }),
    })
    const values = yield* Effect.all(
      [connection.request("echo", { text: "β🔥" }), connection.request("echo", { text: "second" })],
      { concurrency: 2 },
    )
    expect(values).toMatchObject([{ params: { text: "β🔥" } }, { params: { text: "second" } }])
    expect(yield* connection.request("ask-client", {})).toEqual({ configured: true })
    const process = yield* Schema.decodeUnknownEffect(Schema.Struct({ pid: Schema.Number }))(values[0])
    yield* connection.close()
    expect(() => globalThis.process.kill(process.pid, 0)).toThrow()
    expect(connection.closed()).toBe(true)
    expect(Exit.isFailure(yield* Effect.exit(connection.request("echo", {})))).toBe(true)
  }),
)
it.effect("LSP request timeout cancels only that request and keeps the connection usable", () =>
  Effect.gen(function* () {
    const location = yield* Location.Service
    const waiting = yield* Deferred.make<void>()
    const cancelled = yield* Deferred.make<void>()
    const connection = yield* LspStdio.make({
      command,
      directory: location.directory,
      notification: (method) =>
        method === "waiting"
          ? Deferred.succeed(waiting, undefined).pipe(Effect.asVoid)
          : method === "cancelled"
            ? Deferred.succeed(cancelled, undefined).pipe(Effect.asVoid)
            : Effect.void,
    })
    const request = yield* connection
      .request("pending", {}, "1 second")
      .pipe(Effect.exit, Effect.forkChild({ startImmediately: true }))
    yield* Deferred.await(waiting)
    yield* TestClock.adjust(Duration.seconds(1))
    expect(Exit.isFailure(yield* Fiber.join(request))).toBe(true)
    yield* Deferred.await(cancelled)
    expect(yield* connection.request("echo", "still active")).toMatchObject({ params: "still active" })
  }),
)
for (const method of ["fail-frame", "terminate"])
  it.live(`LSP ${method} fails outstanding requests instead of hanging`, () =>
    Effect.gen(function* () {
      const location = yield* Location.Service
      const connection = yield* LspStdio.make({
        command,
        directory: location.directory,
        notification: () => Effect.void,
      })
      const result = yield* Effect.exit(connection.request(method, {}))
      expect(Exit.isFailure(result)).toBe(true)
      expect(connection.closed()).toBe(true)
    }),
  )
