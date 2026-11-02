export * as BackgroundTools from "./background.js"

import { ToolFailure } from "@opencode/ai/effect"
import type { Context } from "@opencode/plugin/effect/plugin"
import { ID } from "@opencode/schema/shell"
import { Effect, Schema } from "effect"
import { Job } from "../../job.js"
import { Permission } from "../../permission.js"
import { Shell } from "../../shell.js"
import { Tool } from "../../tool.js"

const ProcessInput = Schema.Struct({ id: Schema.String })
const Output = Schema.Struct({
  id: Schema.String,
  status: Schema.String,
  output: Schema.String,
  truncated: Schema.optionalKey(Schema.Boolean),
  bytes: Schema.optionalKey(Schema.Number),
})
const Started = Schema.Struct({ shellID: ID })

export function payload(data: string, enter?: boolean) {
  return new TextEncoder().encode(enter === false ? data : `${data}\n`)
}

/** V1 tool contracts backed by the same approved, sandboxed shell and durable jobs as V2. */
export const Plugin = {
  id: "bolt.tool.background",
  effect: Effect.fn("BackgroundTools.Plugin")(function* (ctx: Context) {
    const jobs = yield* Job.Service
    const shell = yield* Shell.Service
    const permissions = yield* Permission.Service
    const registry = yield* Tool.Service
    const find = Effect.fn("BackgroundTools.find")(function* (id: string, context: Tool.Context) {
      const info = yield* jobs.get(id)
      if (!info || info.type !== "shell" || info.metadata?.sessionID !== context.sessionID)
        return yield* Effect.fail(
          new Error(`No background process found with id ${id} in this session. Use list_processes to see known ids.`),
        )
      return info
    })
    const authorize = (info: Job.Info, context: Tool.Context) =>
      permissions.assert({
        action: "shell",
        resources: [typeof info.metadata?.command === "string" ? info.metadata.command : (info.title ?? info.id)],
        save: [],
        sessionID: context.sessionID,
        agent: context.agent,
        source: { type: "tool", messageID: context.messageID, id: context.id },
      })
    const failure = (error: unknown) => new ToolFailure({ message: "Unable to manage background process", error })
    const result = (
      id: string,
      status: string,
      output: string,
      extra: { truncated?: boolean; bytes?: number } = {},
    ) => ({
      output: { id, status, output, ...extra },
      content: output,
      metadata: { id, status, ...extra },
    })
    yield* ctx.tool
      .transform((editor) => {
        editor.add({
          name: "bash_background",
          options: { permission: "shell", codemode: false },
          description:
            "Start a shell command in the background. Returns its id immediately. Use process_output for useful live output, background_stdin for input, and kill_process to stop it. Completion is announced automatically; do not poll repeatedly.",
          input: Schema.Struct({
            command: Schema.String.check(Schema.isMinLength(1)),
            workdir: Schema.optionalKey(Schema.String),
            title: Schema.optionalKey(Schema.String),
          }),
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              if (!input.command.trim()) return yield* Effect.fail(new Error("command is required"))
              const tools = yield* registry.snapshot()
              const response = yield* tools.execute({
                sessionID: context.sessionID,
                agent: context.agent,
                messageID: context.messageID,
                call: {
                  type: "tool-call",
                  id: context.id,
                  name: "shell",
                  input: { ...input, background: true, stdin: true },
                },
                progress: context.progress,
              })
              const started = yield* Schema.decodeUnknownEffect(Started)(response.output)
              return result(
                started.shellID,
                "running",
                `Started background process ${started.shellID}: ${input.command}\nUse process_output with id=${started.shellID} to read its output, and kill_process to stop it.`,
              )
            }).pipe(Effect.mapError(failure)),
        })
        editor.add({
          name: "process_output",
          options: { codemode: false },
          description:
            "Read a session background process's live output or final result. Optional wait is milliseconds, at most 120000; use only when the output is needed now.",
          input: Schema.Struct({
            ...ProcessInput.fields,
            wait: Schema.optionalKey(
              Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(120_000)),
            ),
          }),
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              let info = yield* find(input.id, context)
              if (input.wait && info.status === "running") {
                yield* jobs.wait({ id: input.id, timeout: input.wait })
                info = yield* find(input.id, context)
              }
              let text = info.output ?? info.error ?? ""
              let truncated = false
              if (info.status === "running") {
                const id = yield* Schema.decodeUnknownEffect(ID)(input.id)
                const head = yield* shell.output(id, { cursor: 0, limit: 1 })
                const tail = yield* shell.output(id, { cursor: Math.max(0, head.size - 65_536), limit: 65_536 })
                text = tail.output
                truncated = head.size > 65_536
              } else if (text.length > 65_536) {
                text = text.slice(-65_536)
                truncated = true
              }
              return result(
                info.id,
                info.status,
                `status=${info.status}\n${truncated ? "(showing the newest output)\n" : ""}${text || "(no output yet)"}`,
                { truncated },
              )
            }).pipe(Effect.mapError(failure)),
        })
        editor.add({
          name: "background_stdin",
          options: { permission: "shell", codemode: false },
          description:
            "Write text to a running session background process. Appends a newline unless enter is false. Input is limited to 64 KiB per call.",
          input: Schema.Struct({
            ...ProcessInput.fields,
            data: Schema.String,
            enter: Schema.optionalKey(Schema.Boolean),
          }),
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              const info = yield* find(input.id, context)
              if (info.status !== "running")
                return yield* Effect.fail(
                  new Error(`Process ${info.id} has already exited (status=${info.status}); its stdin is closed.`),
                )
              const bytes = payload(input.data, input.enter)
              if (bytes.byteLength > 65_536) return yield* Effect.fail(new Error("Process input exceeds 64 KiB"))
              yield* authorize(info, context)
              yield* shell.stdin(yield* Schema.decodeUnknownEffect(ID)(info.id), bytes)
              return result(
                info.id,
                info.status,
                `Wrote ${bytes.byteLength} bytes to stdin of ${info.id}. Use process_output with id=${info.id} to read its response.`,
                { bytes: bytes.byteLength },
              )
            }).pipe(Effect.mapError(failure)),
        })
        editor.add({
          name: "kill_process",
          options: { permission: "shell", codemode: false },
          description:
            "Cancel a session background process by its exact id. Already finished processes retain their terminal state.",
          input: ProcessInput,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              const info = yield* find(input.id, context)
              if (info.status !== "running")
                return result(info.id, info.status, `Process ${info.id} is now ${info.status}.`)
              yield* authorize(info, context)
              const cancelled = (yield* jobs.cancel(info.id)) ?? info
              return result(info.id, cancelled.status, `Process ${info.id} is now ${cancelled.status}.`)
            }).pipe(Effect.mapError(failure)),
        })
        editor.add({
          name: "list_processes",
          options: { codemode: false },
          description: "List background shell jobs belonging to the current session, including finished jobs.",
          input: Schema.Struct({}),
          output: Schema.Struct({ count: Schema.Number, output: Schema.String }),
          execute: (_input, context) =>
            Effect.gen(function* () {
              const list = (yield* jobs.list).filter(
                (job) => job.type === "shell" && job.metadata?.sessionID === context.sessionID,
              )
              const output = list.length
                ? list.map((job) => `${job.id} [${job.status}] ${job.title ?? ""}`).join("\n")
                : "No background processes have been started in this session."
              return { output: { count: list.length, output }, content: output, metadata: { count: list.length } }
            }).pipe(Effect.mapError(failure)),
        })
      })
      .pipe(Effect.orDie)
  }),
}
