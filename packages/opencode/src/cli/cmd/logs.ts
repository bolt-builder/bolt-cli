import fs from "node:fs"
import path from "node:path"
import { Effect } from "effect"
import { Global } from "@opencode-ai/core/global"
import { effectCmd, fail } from "../effect-cmd"

const FILE = path.join(Global.Path.log, "opencode.log")

export const LogsCommand = effectCmd({
  command: "logs",
  describe: "print the agent log",
  instance: false,
  builder: (yargs) =>
    yargs
      .option("tail", {
        describe: "number of trailing lines to print",
        type: "number",
        default: 1000,
      })
      .option("follow", {
        alias: "f",
        describe: "stream new log lines as they are written",
        type: "boolean",
        default: false,
      }),
  handler: Effect.fn("Cli.logs")(function* (args) {
    if (!fs.existsSync(FILE)) return yield* fail(`no log file at ${FILE}`)
    const text = yield* Effect.promise(() => Bun.file(FILE).text())
    const lines = text.split("\n")
    if (lines.at(-1) === "") lines.pop()
    const count = Math.max(0, Math.floor(args.tail))
    for (const line of lines.slice(-count)) console.log(line)
    if (!args.follow) return
    // Follow by re-reading appended bytes whenever the file changes; the log
    // is append-only so the previous size is always a valid resume offset.
    let offset = Buffer.byteLength(text)
    yield* Effect.callback<void>(() => {
      const watcher = fs.watch(path.dirname(FILE), (_, name) => {
        if (name !== path.basename(FILE)) return
        const size = fs.statSync(FILE, { throwIfNoEntry: false })?.size ?? 0
        if (size <= offset) {
          offset = size
          return
        }
        const stream = fs.createReadStream(FILE, { start: offset, end: size - 1, encoding: "utf8" })
        stream.on("data", (chunk) => process.stdout.write(chunk))
        offset = size
      })
      return Effect.sync(() => watcher.close())
    })
  }),
})
