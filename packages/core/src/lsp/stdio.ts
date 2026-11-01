export * as LspStdio from "./stdio.js"

import { Cause, Deferred, Duration, Effect, Exit, Queue, Result, Schema, Scope, Stream } from "effect"
import { ChildProcess } from "effect/process"
import { Environment } from "../environment/index.js"

export const MAX_FRAME_BYTES = 16 * 1024 * 1024
const Message = Schema.Struct({
  jsonrpc: Schema.Literal("2.0"),
  id: Schema.optionalKey(Schema.Union([Schema.String, Schema.Number, Schema.Null])),
  method: Schema.optionalKey(Schema.String),
  params: Schema.optionalKey(Schema.Unknown),
  result: Schema.optionalKey(Schema.Unknown),
  error: Schema.optionalKey(
    Schema.Struct({ code: Schema.Number, message: Schema.String, data: Schema.optionalKey(Schema.Unknown) }),
  ),
})
export type Message = typeof Message.Type

/** LSP lengths count UTF-8 bytes, independently of chunk or character boundaries. */
export class Reader {
  private header: number[] = []
  private length: number | undefined
  private chunks: Uint8Array[] = []
  private size = 0

  push(chunk: Uint8Array) {
    const messages: Message[] = []
    let offset = 0
    while (offset < chunk.length) {
      if (this.length === undefined) {
        this.header.push(chunk[offset++])
        if (this.header.length > 8192) throw new Error("LSP headers exceed 8 KiB")
        const end = this.header.length
        if (
          this.header[end - 4] !== 13 ||
          this.header[end - 3] !== 10 ||
          this.header[end - 2] !== 13 ||
          this.header[end - 1] !== 10
        )
          continue
        const values = Buffer.from(this.header)
          .toString("ascii")
          .trim()
          .split("\r\n")
          .flatMap((line) => (/^content-length\s*:/i.test(line) ? [line.replace(/^content-length\s*:\s*/i, "")] : []))
        if (values.length !== 1 || !/^\d+$/.test(values[0])) throw new Error("Invalid LSP Content-Length")
        this.length = Number(values[0])
        if (!Number.isSafeInteger(this.length) || this.length <= 0 || this.length > MAX_FRAME_BYTES)
          throw new Error("LSP message exceeds the 16 MiB limit or has an invalid length")
        this.header = []
        continue
      }
      const end = Math.min(chunk.length, offset + this.length - this.size)
      this.chunks.push(chunk.subarray(offset, end))
      this.size += end - offset
      offset = end
      if (this.size !== this.length) continue
      const bytes = this.chunks.length === 1 ? this.chunks[0] : Buffer.concat(this.chunks, this.size)
      messages.push(
        Schema.decodeUnknownSync(Schema.fromJsonString(Message))(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        ),
      )
      this.length = undefined
      this.chunks = []
      this.size = 0
    }
    return messages
  }

  end() {
    if (this.header.length || this.size || this.length !== undefined)
      throw new Error("LSP server ended with an incomplete message")
  }
}

export function encode(message: Message) {
  const body = Buffer.from(JSON.stringify(message))
  if (body.length > MAX_FRAME_BYTES) throw new Error("LSP request exceeds 16 MiB")
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body])
}

export type Options = {
  command: readonly string[]
  directory: string
  environment?: Record<string, string>
  notification: (method: string, params: unknown) => Effect.Effect<void, Error>
  request?: (method: string, params: unknown) => Effect.Effect<unknown, Error>
}

/** The Location scope owns the process; individual requests can be cancelled independently. */
export const make = Effect.fn("LspStdio.make")(function* (options: Options) {
  if (!options.command[0]) return yield* Effect.fail(new Error("LSP command must not be empty"))
  const environment = yield* Environment.Service
  const parent = yield* Effect.scope
  const scope = yield* Scope.fork(parent, "sequential")
  return yield* Effect.gen(function* () {
    const outgoing = yield* Queue.bounded<Uint8Array, Cause.Done>(64)
    const pending = new Map<string | number, Deferred.Deferred<unknown, Error>>()
    const state = { closed: false, sequence: 0, stderr: "" }
    const handle = yield* environment.spawner.spawn(
      ChildProcess.make(options.command[0], [...options.command.slice(1)], {
        cwd: options.directory,
        env: options.environment,
        extendEnv: true,
        stdin: { stream: Stream.fromQueue(outgoing), endOnDone: true },
        stdout: "pipe",
        stderr: "pipe",
        forceKillAfter: "2 seconds",
      }),
    )
    const send = (message: Message) =>
      Effect.gen(function* () {
        if (state.closed) return yield* Effect.fail(new Error("LSP server is closed"))
        const bytes = yield* Effect.try(() => encode(message))
        if (!(yield* Queue.offer(outgoing, bytes))) return yield* Effect.fail(new Error("LSP input is closed"))
      })
    const fail = (error: Error) =>
      Effect.gen(function* () {
        if (state.closed) return
        state.closed = true
        yield* Queue.end(outgoing)
        yield* Effect.forEach(pending.values(), (request) => Deferred.fail(request, error), { discard: true })
        pending.clear()
      })
    yield* Effect.addFinalizer(() => fail(new Error("LSP connection closed")))
    yield* handle.stderr.pipe(
      Stream.decodeText(),
      Stream.runForEach((chunk) =>
        Effect.sync(() => {
          state.stderr = (state.stderr + chunk).slice(-2000)
        }),
      ),
      Effect.ignore,
      Effect.forkScoped,
    )
    const receive = (message: Message) =>
      Effect.gen(function* () {
        if (message.method !== undefined) {
          if (message.id === undefined || message.id === null)
            return yield* options.notification(message.method, message.params)
          const response = options.request
            ? yield* Effect.result(options.request(message.method, message.params))
            : undefined
          if (response && Result.isSuccess(response))
            return yield* send({ jsonrpc: "2.0", id: message.id, result: response.success ?? null })
          return yield* send({
            jsonrpc: "2.0",
            id: message.id,
            error: { code: -32601, message: "Client method unavailable" },
          })
        }
        if (message.id === undefined || message.id === null) return
        const request = pending.get(message.id)
        if (!request) return
        if (message.error)
          yield* Deferred.fail(request, new Error(`LSP error ${message.error.code}: ${message.error.message}`))
        else if (Object.hasOwn(message, "result")) yield* Deferred.succeed(request, message.result)
        else yield* Deferred.fail(request, new Error("LSP response is missing result/error"))
      })
    const reader = new Reader()
    yield* handle.stdout.pipe(
      Stream.runForEach((chunk) =>
        Effect.try(() => reader.push(chunk)).pipe(
          Effect.flatMap((messages) => Effect.forEach(messages, receive, { discard: true })),
        ),
      ),
      Effect.andThen(Effect.try(() => reader.end())),
      Effect.catch((error) =>
        fail(error instanceof Error ? error : new Error(String(error))).pipe(
          Effect.andThen(handle.kill({ killSignal: "SIGTERM" }).pipe(Effect.ignore)),
        ),
      ),
      Effect.onExit((exit) =>
        Exit.hasInterrupts(exit)
          ? fail(new Error("LSP connection closed"))
          : Effect.gen(function* () {
              const code = yield* handle.exitCode.pipe(
                Effect.timeoutOption(Duration.seconds(1)),
                Effect.orElseSucceed(() => undefined),
              )
              const detail = state.stderr.trim()
              yield* fail(
                new Error(
                  `LSP server exited${code?._tag === "Some" ? ` with code ${code.value}` : ""}${detail ? `: ${detail}` : ""}`,
                ),
              )
            }),
      ),
      Effect.forkScoped,
    )
    const request = (method: string, params: unknown, timeout: Duration.Input = "30 seconds") =>
      Effect.gen(function* () {
        const id = ++state.sequence
        const response = yield* Deferred.make<unknown, Error>()
        pending.set(id, response)
        return yield* send({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) }).pipe(
          Effect.andThen(Deferred.await(response)),
          Effect.timeoutOrElse({
            duration: timeout,
            orElse: () => Effect.fail(new Error(`LSP request timed out: ${method}`)),
          }),
          Effect.onError(() => send({ jsonrpc: "2.0", method: "$/cancelRequest", params: { id } }).pipe(Effect.ignore)),
          Effect.ensuring(Effect.sync(() => pending.delete(id))),
        )
      })
    return {
      request,
      notify: (method: string, params?: unknown) =>
        send({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) }),
      closed: () => state.closed,
      close: () => Scope.close(scope, Exit.void),
    }
  }).pipe(
    Scope.provide(scope),
    Effect.onError(() => Scope.close(scope, Exit.void)),
  )
})
export type Connection = Effect.Success<ReturnType<typeof make>>
