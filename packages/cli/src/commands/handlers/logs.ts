import fs from "node:fs"
import { Effect, Option } from "effect"
import { Logging } from "@opencode/util/observability/logging"
import { OPENCODE_LOCAL, OPENCODE_CHANNEL } from "../../version"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Envelope } from "../../util/envelope"
import { Porcelain } from "../../util/porcelain"
import { Tail } from "../../util/tail"
import { errorMessage } from "../../util/error"

export const LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"] as const

/** Parses the level=... field from a logfmt line, if present. */
export function level(line: string) {
  const match = line.match(/(?:^|\s)level=(\w+)/)
  return match ? match[1] : undefined
}

/**
 * Builds a stateful line predicate. Level filtering keeps entries at or above
 * the minimum severity; lines without a level field (stack traces, wrapped
 * output) inherit the decision of the entry they continue. Session filtering
 * matches the ID anywhere in the line (session.id=..., sessionID=...).
 */
export function filter(opts: { level?: string; session?: string }) {
  const minimum = opts.level ? LEVELS.indexOf(opts.level as (typeof LEVELS)[number]) : 0
  const flags = { keep: true }
  return (line: string) => {
    const parsed = level(line)
    if (parsed !== undefined) {
      const severity = LEVELS.indexOf(parsed as (typeof LEVELS)[number])
      flags.keep = severity === -1 || severity >= minimum
      if (flags.keep && opts.session) flags.keep = line.includes(opts.session)
      return flags.keep
    }
    // Continuation line: follow the previous entry, but still honor an
    // explicit session match so orphaned lines do not leak between sessions.
    const session = line.match(/(?:^|\s)(?:session(?:\.id|ID|Id|_id)?)[=:]\s*["']?([^\s"',]+)/i)?.[1]
    return flags.keep && (!opts.session || !session || session === opts.session)
  }
}

export default Runtime.handler(Commands.commands.logs, (args) =>
  Effect.gen(function* () {
    if (args.json && args.porcelain)
      return yield* Effect.fail(new Error("--json and --porcelain are mutually exclusive"))
    if (args.follow && (args.json || args.porcelain))
      return yield* Effect.fail(new Error("--follow cannot be combined with --json or --porcelain"))
    if (args.tail < 0) return yield* Effect.fail(new Error("--tail must be a non-negative integer"))
    const target = Option.getOrUndefined(args.file) ?? Logging.file(OPENCODE_LOCAL, OPENCODE_CHANNEL)
    if (!fs.existsSync(target)) return yield* Effect.fail(new Error(`no log file at ${target}`))
    const text = yield* Effect.tryPromise(() => Bun.file(target).text())
    const lines = text.split("\n")
    if (lines.at(-1) === "") lines.pop()
    const keep = filter({ level: Option.getOrUndefined(args.level), session: Option.getOrUndefined(args.session) })
    const filtered = lines.filter(keep)
    const shown = args.tail === 0 ? [] : filtered.slice(-args.tail)
    if (args.json) {
      Envelope.print({ file: target, lines: shown })
      return
    }
    if (args.porcelain) {
      for (const line of shown) Porcelain.print("log", line)
      return
    }
    if (!args.follow) {
      const { Pager } = yield* Effect.promise(() => import("../../util/pager"))
      yield* Effect.tryPromise(() => Pager.page(shown.join("\n")))
      return
    }
    for (const line of shown) process.stdout.write(line + "\n")
    yield* Effect.callback<void>(() => {
      const close = Tail.follow(target, Buffer.byteLength(text), keep)
      return Effect.sync(close)
    })
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        if (args.json) Envelope.printError("Error", errorMessage(error))
        else process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
