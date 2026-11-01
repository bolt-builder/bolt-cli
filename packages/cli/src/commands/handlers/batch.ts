import path from "node:path"
import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { execute } from "../../services/answer"

/**
 * Parse a batch file into prompts: one prompt per non-empty line, `#` lines
 * are comments. Lines ending with a backslash continue onto the next line so
 * longer prompts stay expressible.
 */
export function parse(text: string): string[] {
  const joined = text.replace(/\\\r?\n/g, " ")
  return joined
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("#"))
}

export interface Row {
  index: number
  status: "ok" | "error"
  duration: number
  prompt: string
  detail?: string
}

/** Compact duration for the summary table. */
export function duration(ms: number) {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`
}

/** Render the end-of-run summary table. */
export function table(rows: Row[]): string {
  const width = 60
  const header = ["#".padEnd(4), "status".padEnd(7), "time".padEnd(8), "prompt"].join(" ")
  const lines = rows.map((row) => {
    const prompt = row.prompt.length > width ? row.prompt.slice(0, width - 3) + "..." : row.prompt
    const suffix = row.detail ? `  (${row.detail})` : ""
    return [String(row.index).padEnd(4), row.status.padEnd(7), duration(row.duration).padEnd(8), prompt + suffix].join(
      " ",
    )
  })
  const failed = rows.filter((row) => row.status === "error").length
  const summary = `${rows.length - failed}/${rows.length} succeeded`
  return [header, "-".repeat(header.length + width - 6), ...lines, "", summary].join("\n")
}

export default Runtime.handler(Commands.commands.batch, (input) =>
  Effect.gen(function* () {
    if (!Number.isInteger(input.parallel) || input.parallel < 1)
      return yield* Effect.fail(new Error("--parallel must be a positive integer"))
    const file = Bun.file(path.resolve(input.file))
    if (!(yield* Effect.promise(() => file.exists())))
      return yield* Effect.fail(new Error(`Batch file not found: ${input.file}`))
    const prompts = parse(yield* Effect.promise(() => file.text()))
    if (!prompts.length) return yield* Effect.fail(new Error("No prompts found in the batch file."))
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    const rows = yield* Effect.forEach(
      prompts,
      (prompt, index) =>
        Effect.tryPromise(async () => {
          const started = Date.now()
          process.stdout.write(`── prompt ${index + 1}/${prompts.length} started ──\n`)
          try {
            const result = await execute({
              client,
              text: prompt,
              title: `bolt batch ${index + 1}/${prompts.length}`,
              agent: Option.getOrElse(input.agent, () => "build"),
              model: Option.getOrUndefined(input.model),
              retain: true,
              permissions: [
                { action: "edit", resource: "*", effect: "allow" },
                { action: "shell", resource: "*", effect: "allow" },
              ],
            })
            process.stdout.write(
              `── prompt ${index + 1} finished (${duration(Date.now() - started)}) ──\n${result.text}\n`,
            )
            return { index: index + 1, status: "ok", duration: Date.now() - started, prompt } satisfies Row
          } catch (error) {
            return {
              index: index + 1,
              status: "error",
              duration: Date.now() - started,
              prompt,
              detail: error instanceof Error ? error.message : String(error),
            } satisfies Row
          }
        }),
      { concurrency: input.parallel },
    )
    process.stdout.write(`\n${table(rows)}\n`)
    if (rows.some((row) => row.status === "error")) process.exitCode ||= 1
  }),
)
