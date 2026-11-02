export * as ProfileTool from "./profile.js"

import type { Context } from "@opencode/plugin/effect/plugin"
import { ToolFailure } from "@opencode/ai/effect"
import { Clock, Effect, Option, Schema } from "effect"
import path from "node:path"
import { Environment } from "../../environment/index.js"
import { FileAccess } from "../../file-access.js"
import { Location } from "../../location.js"
import { Permission } from "../../permission.js"
import { ShellSelect } from "../../shell/select.js"
import { Tool } from "../../tool.js"
import { quote } from "../shell-quote.js"
import DESCRIPTION from "./profile.txt"

export const Profile = Schema.Struct({
  nodes: Schema.Array(
    Schema.Struct({
      id: Schema.Number,
      callFrame: Schema.Struct({
        functionName: Schema.String,
        url: Schema.String,
        lineNumber: Schema.Number,
      }),
      children: Schema.optionalKey(Schema.Array(Schema.Number)),
    }),
  ),
  samples: Schema.optionalKey(Schema.Array(Schema.Number)),
  timeDeltas: Schema.optionalKey(Schema.Array(Schema.Number)),
})

export type Frame = {
  name: string
  location: string
  self: number
  total: number
}

// V8 bookkeeping frames that carry no user code.
const meta = new Set(["(root)", "(program)", "(idle)", "(garbage collector)"])

/**
 * Aggregate a V8 .cpuprofile into hot frames sorted by self time.
 * Times are in microseconds. Nodes sharing a function/location are merged;
 * for recursive functions the merged total can exceed wall time.
 */
export function aggregate(profile: typeof Profile.Type, limit: number): Frame[] {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]))
  const samples = profile.samples ?? []
  const deltas = profile.timeDeltas ?? []
  const self = new Map<number, number>()
  samples.forEach((id, index) => {
    self.set(id, (self.get(id) ?? 0) + Math.max(0, deltas[index] ?? 0))
  })
  const totals = new Map<number, number>()
  const total = (id: number): number => {
    const cached = totals.get(id)
    if (cached !== undefined) return cached
    const node = nodes.get(id)
    if (!node) return 0
    // The node graph is a tree, so seeding the memo before recursing is enough to stay safe.
    totals.set(id, self.get(id) ?? 0)
    const sum = (node.children ?? []).reduce((acc, child) => acc + total(child), self.get(id) ?? 0)
    totals.set(id, sum)
    return sum
  }
  const merged = new Map<string, Frame>()
  for (const node of profile.nodes) {
    if (meta.has(node.callFrame.functionName)) continue
    const name = node.callFrame.functionName || "(anonymous)"
    const location = node.callFrame.url ? `${node.callFrame.url}:${node.callFrame.lineNumber + 1}` : "(native)"
    const key = `${name}\u0000${location}`
    const existing = merged.get(key) ?? { name, location, self: 0, total: 0 }
    existing.self += self.get(node.id) ?? 0
    existing.total += total(node.id)
    merged.set(key, existing)
  }
  return [...merged.values()]
    .filter((frame) => frame.self > 0 || frame.total > 0)
    .sort((a, b) => b.self - a.self || b.total - a.total)
    .slice(0, limit)
}

/**
 * Decide how to profile a command: Bun and Node get the built-in V8 CPU
 * profiler writing into `dir`, everything else falls back to /usr/bin/time.
 */
export function plan(command: string, dir: string, powershell = false) {
  const match = command.trim().match(/^("[^"\n]+"|'[^'\n]+'|[^\s]+)([\s\S]*)$/)
  const token = match?.[1] ?? ""
  const runtime = path.basename(token.replace(/^['"]|['"]$/g, "")).replace(/\.exe$/i, "")
  const quoted = quote(dir, powershell)
  if (runtime === "bun" || runtime === "node")
    return {
      kind: "cpuprofile" as const,
      command: `${powershell && token.startsWith('"') ? "& " : ""}${token} --cpu-prof --cpu-prof-dir=${quoted}${match?.[2] ?? ""}`,
    }
  return { kind: "time" as const, command: `/usr/bin/time -v ${command}` }
}

/** Render hot frames as an aligned table. Times converted to milliseconds. */
export function render(frames: Frame[]) {
  const ms = (micros: number) => (micros / 1000).toFixed(1)
  const rows = frames.map((frame) => [ms(frame.self), ms(frame.total), frame.name, frame.location])
  const header = ["self(ms)", "total(ms)", "function", "location"]
  const widths = [header, ...rows].reduce(
    (acc, row) => acc.map((width, index) => Math.max(width, row[index].length)),
    [0, 0, 0, 0],
  )
  const line = (row: string[]) =>
    [row[0].padStart(widths[0]), row[1].padStart(widths[1]), row[2].padEnd(widths[2]), row[3]].join("  ")
  return [line(header), ...rows.map(line)].join("\n")
}

export const Input = Schema.Struct({
  command: Schema.String.check(Schema.isMinLength(1)),
  duration: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThan(0))),
  limit: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 }))),
})
const Output = Schema.Struct({
  command: Schema.String,
  mode: Schema.Literals(["cpu-profile", "time", "plain"]),
  exit: Schema.optionalKey(Schema.Number),
  timeout: Schema.Boolean,
  frames: Schema.Array(
    Schema.Struct({ name: Schema.String, location: Schema.String, self: Schema.Number, total: Schema.Number }),
  ),
  output: Schema.String,
  truncated: Schema.Boolean,
})
const ShellOutput = Schema.Struct({
  output: Schema.String,
  exit: Schema.optionalKey(Schema.Number),
  timeout: Schema.optionalKey(Schema.Boolean),
  status: Schema.optionalKey(Schema.Literals(["completed", "running"])),
  truncated: Schema.Boolean,
})

export const Plugin = {
  id: "bolt.tool.profile",
  effect: Effect.fn("ProfileTool.Plugin")(function* (ctx: Context) {
    const environment = yield* Environment.Service
    const access = yield* FileAccess.Service
    const location = yield* Location.Service
    const permission = yield* Permission.Service
    const registry = yield* Tool.Service
    const select = yield* ShellSelect.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name: "profile",
          options: { codemode: false },
          description: DESCRIPTION,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              if (!input.command.trim()) return yield* Effect.fail(new Error("command must not be empty"))
              const tools = yield* registry.snapshot()
              if (!tools.definitions.some((tool) => tool.name === "shell"))
                return yield* Effect.fail(new Error("The shell tool is unavailable; profile cannot execute commands."))
              yield* permission.assert({
                action: "profile",
                resources: [input.command],
                save: ["*"],
                metadata: { command: input.command },
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.messageID, id: context.id },
              })
              const target = yield* access.resolve({
                path: path.join(location.directory, ".bolt", "tmp", `profile-${crypto.randomUUID()}`),
                kind: "directory",
              })
              yield* access.authorizeExternal([target], context)
              const shell = yield* select.resolve({ priority: "config" })
              const planned = plan(input.command, target.absolute, ShellSelect.ps(shell))
              const timed = planned.kind === "time" && (yield* Environment.exists(environment.files, "/usr/bin/time"))
              const command = planned.kind === "cpuprofile" || timed ? planned.command : input.command
              const mode =
                planned.kind === "cpuprofile"
                  ? ("cpu-profile" as const)
                  : timed
                    ? ("time" as const)
                    : ("plain" as const)
              yield* environment.files.mkdir(target.absolute)
              return yield* Effect.gen(function* () {
                const started = yield* Clock.currentTimeMillis
                const result = yield* tools.execute({
                  sessionID: context.sessionID,
                  agent: context.agent,
                  messageID: context.messageID,
                  call: {
                    type: "tool-call",
                    id: context.id,
                    name: "shell",
                    input: { command, workdir: location.directory, timeout: input.duration ?? 30_000 },
                  },
                  progress: context.progress,
                })
                const captured = yield* Schema.decodeUnknownEffect(ShellOutput)(result.output)
                const elapsed = (yield* Clock.currentTimeMillis) - started
                const lines = [
                  `command=${input.command}`,
                  `mode=${mode}`,
                  ...(captured.exit === undefined ? [] : [`exit=${captured.exit}`]),
                  `elapsed=${elapsed}ms`,
                  ...(captured.timeout ? [`killed after ${input.duration ?? 30_000}ms duration cap`] : []),
                ]
                let frames: Frame[] = []
                if (mode === "cpu-profile") {
                  const files = (yield* environment.files.list(target.absolute))
                    .filter((file) => file.name.endsWith(".cpuprofile") && file.type === "file")
                    .sort((a, b) => a.name.localeCompare(b.name))
                  if (files[0]) {
                    const file = yield* environment.files.read(path.join(target.absolute, files[0].name), {
                      offset: 0,
                      length: 16 * 1024 * 1024 + 1,
                    })
                    if (file.info.size > 16 * 1024 * 1024)
                      return yield* Effect.fail(new Error("CPU profile exceeds 16 MiB"))
                    const parsed = Schema.decodeUnknownOption(Schema.fromJsonString(Profile))(
                      new TextDecoder().decode(file.bytes),
                    )
                    if (Option.isSome(parsed)) {
                      frames = aggregate(parsed.value, input.limit ?? 10)
                      lines.push("", `Top ${frames.length} hot frames by self time:`, "", render(frames))
                    } else lines.push("", `Could not parse ${files[0].name} as a V8 CPU profile.`)
                  } else
                    lines.push(
                      "",
                      captured.timeout
                        ? "No .cpuprofile was written: the process was killed at the duration cap before it could exit cleanly. Profile a bounded workload instead."
                        : "No .cpuprofile was written by the runtime.",
                      "",
                      "Output tail:",
                      captured.output.trimEnd() || "(no output)",
                    )
                } else
                  lines.push(
                    "",
                    timed
                      ? "Non-JS command: no CPU profile available, /usr/bin/time -v resource summary below."
                      : "Non-JS command and /usr/bin/time is not installed: plain run, wall time only.",
                    "",
                    captured.output.trimEnd() || "(no output)",
                  )
                return {
                  output: {
                    command: input.command,
                    mode,
                    ...(captured.exit === undefined ? {} : { exit: captured.exit }),
                    timeout: captured.timeout ?? false,
                    frames,
                    output: lines.join("\n"),
                    truncated: captured.truncated,
                  },
                  content: lines.join("\n"),
                  metadata: { command: input.command, mode, frames: frames.length },
                }
              }).pipe(Effect.ensuring(environment.files.remove(target.absolute).pipe(Effect.orDie)))
            }).pipe(Effect.mapError((error) => new ToolFailure({ message: "Unable to profile command", error }))),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
