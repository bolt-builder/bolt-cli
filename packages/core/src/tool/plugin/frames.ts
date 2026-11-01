export * as FramesTool from "./frames.js"

import type { Context } from "@opencode/plugin/effect/plugin"
import { ToolFailure } from "@opencode/ai/effect"
import { Effect, Schema } from "effect"
import path from "node:path"
import { Environment } from "../../environment/index.js"
import { FileAccess } from "../../file-access.js"
import { Location } from "../../location.js"
import { Permission } from "../../permission.js"
import { ShellSelect } from "../../shell/select.js"
import { Tool } from "../../tool.js"
import { quote } from "../shell-quote.js"
import DESCRIPTION from "./frames.txt"

const MAX_FRAMES = 50

/**
 * Parse a timestamp string into seconds. Accepts plain seconds ("90", "12.5"),
 * minutes:seconds ("1:30"), and hours:minutes:seconds ("1:02:03.5").
 * Returns undefined for anything invalid.
 */
export function seconds(stamp: string): number | undefined {
  const trimmed = stamp.trim()
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number.isFinite(Number(trimmed)) ? Number(trimmed) : undefined
  const match = trimmed.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/)
  if (!match) return undefined
  const hours = match[1] ? Number(match[1]) : 0
  const minutes = Number(match[2])
  const secs = Number(match[3])
  if (minutes >= 60 || secs >= 60) return undefined
  const result = hours * 3600 + minutes * 60 + secs
  return Number.isFinite(result) ? result : undefined
}

/**
 * Evenly spaced sample points (in seconds) for `count` frames across
 * `duration`, centered in each slice so the very start and end are avoided.
 */
export function spread(duration: number, count: number): number[] {
  if (duration <= 0 || count <= 0) return []
  return Array.from({ length: count }, (_, index) => Number(((duration * (index + 0.5)) / count).toFixed(3)))
}

/** Build ffmpeg args to extract one still at `at` seconds into `out`. */
export function args(video: string, at: number, out: string): string[] {
  // -ss before -i uses the fast keyframe seek; -frames:v 1 grabs a single still.
  return ["-hide_banner", "-loglevel", "error", "-ss", String(at), "-i", video, "-frames:v", "1", "-y", out]
}

export const Input = Schema.Struct({
  video: Schema.String,
  timestamps: Schema.optionalKey(
    Schema.Array(Schema.String).check(Schema.isMinLength(1), Schema.isMaxLength(MAX_FRAMES)),
  ),
  count: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThan(0))),
})
const Output = Schema.Struct({
  video: Schema.String,
  images: Schema.Array(Schema.String),
  failures: Schema.Array(Schema.String),
})
const ShellOutput = Schema.Struct({
  output: Schema.String,
  exit: Schema.optionalKey(Schema.Number),
  timeout: Schema.optionalKey(Schema.Boolean),
  truncated: Schema.Boolean,
})

export const Plugin = {
  id: "bolt.tool.frames",
  effect: Effect.fn("FramesTool.Plugin")(function* (ctx: Context) {
    const environment = yield* Environment.Service
    const access = yield* FileAccess.Service
    const location = yield* Location.Service
    const permission = yield* Permission.Service
    const registry = yield* Tool.Service
    const select = yield* ShellSelect.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name: "frames",
          options: { codemode: false },
          description: DESCRIPTION,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              if ((input.timestamps === undefined) === (input.count === undefined))
                return yield* Effect.fail(new Error("pass exactly one of timestamps or count"))
              const video = yield* access.authorizeRead(input.video, context)
              if ((yield* Environment.typeFollowing(environment.files, video.absolute)) !== "file")
                return yield* Effect.fail(new Error(`video not found: ${input.video}`))
              yield* permission.assert({
                action: "frames",
                resources: [video.resource],
                save: ["*"],
                metadata: { video: video.resource, timestamps: input.timestamps, count: input.count },
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.messageID, id: context.id },
              })
              const tools = yield* registry.snapshot()
              if (!tools.definitions.some((tool) => tool.name === "shell"))
                return yield* Effect.fail(new Error("The shell tool is unavailable; frames cannot extract images."))
              const shell = yield* select.resolve({ priority: "config" })
              const ps = ShellSelect.ps(shell)
              const run = (argv: string[]) =>
                tools
                  .execute({
                    sessionID: context.sessionID,
                    agent: context.agent,
                    messageID: context.messageID,
                    call: {
                      type: "tool-call",
                      id: context.id,
                      name: "shell",
                      input: {
                        command: argv.map((arg) => quote(arg, ps)).join(" "),
                        workdir: location.directory,
                        timeout: 30_000,
                      },
                    },
                    progress: context.progress,
                  })
                  .pipe(Effect.flatMap((result) => Schema.decodeUnknownEffect(ShellOutput)(result.output)))
              const points = input.timestamps
                ? input.timestamps.map((stamp) => ({ stamp, at: seconds(stamp) }))
                : yield* Effect.gen(function* () {
                    const probe = yield* run([
                      "ffprobe",
                      "-v",
                      "error",
                      "-protocol_whitelist",
                      "file,pipe",
                      "-show_entries",
                      "format=duration",
                      "-of",
                      "csv=p=0",
                      video.absolute,
                    ])
                    const duration = Number(probe.output.trim())
                    if (probe.exit !== 0 || !Number.isFinite(duration) || duration <= 0)
                      return yield* Effect.fail(
                        new Error(
                          `could not read video duration; count requires ffprobe on PATH: ${probe.output.slice(-1000) || "no ffprobe output"}`,
                        ),
                      )
                    return spread(duration, Math.min(input.count ?? 0, MAX_FRAMES)).map((at) => ({
                      stamp: `${at}s`,
                      at,
                    }))
                  })
              const invalid = points.filter((point) => point.at === undefined).map((point) => point.stamp)
              if (invalid.length) return yield* Effect.fail(new Error(`invalid timestamps: ${invalid.join(", ")}`))
              const target = yield* access.resolve({
                path: path.join(location.directory, ".bolt", "tmp", `frames-${crypto.randomUUID()}`),
                kind: "directory",
              })
              yield* access.authorizeExternal([target], context)
              yield* environment.files.mkdir(target.absolute)
              const images: string[] = []
              const failures: string[] = []
              return yield* Effect.gen(function* () {
                for (const [index, point] of points.entries()) {
                  const out = path.join(
                    target.absolute,
                    `frame-${String(index + 1).padStart(3, "0")}-at-${point.at}s.png`,
                  )
                  const result = yield* run([
                    "ffmpeg",
                    "-protocol_whitelist",
                    "file,pipe",
                    ...args(video.absolute, point.at ?? 0, out),
                  ])
                  if (result.exit === 0 && (yield* Environment.exists(environment.files, out))) images.push(out)
                  else
                    failures.push(
                      `${point.stamp}: ${result.timeout ? "ffmpeg timed out" : result.output.trim().slice(-1000) || `ffmpeg exited with ${result.exit}`}; ensure ffmpeg is installed on PATH`,
                    )
                }
                const lines = [
                  ...(images.length
                    ? [
                        `Extracted ${images.length} frame${images.length === 1 ? "" : "s"} from ${video.absolute}:`,
                        "",
                        ...images,
                        "",
                        "Use the read tool on these paths to view the frames.",
                      ]
                    : []),
                  ...(failures.length ? ["", "Failed timestamps:", ...failures.map((failure) => `- ${failure}`)] : []),
                ]
                return {
                  output: { video: video.absolute, images, failures },
                  content: lines.join("\n"),
                  metadata: { video: video.absolute, extracted: images.length, failed: failures.length },
                }
              }).pipe(
                Effect.onExit((exit) =>
                  exit._tag === "Failure" || !images.length
                    ? environment.files.remove(target.absolute).pipe(Effect.orDie)
                    : Effect.void,
                ),
              )
            }).pipe(Effect.mapError((error) => new ToolFailure({ message: "Unable to extract frames", error }))),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
