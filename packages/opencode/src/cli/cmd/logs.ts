import fs from "node:fs"
import path from "node:path"
import { Effect } from "effect"
import { Global } from "@opencode-ai/core/global"
import { effectCmd, fail } from "../effect-cmd"
import { Tail } from "@/util/tail"

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
    // slice(-0) === slice(0) returns the whole array, so guard 0 explicitly to
    // mean "print no history" (e.g. `logs --tail 0 --follow` to stream only new lines).
    for (const line of count === 0 ? [] : lines.slice(-count)) console.log(line)
    if (!args.follow) return
    // Follow by re-reading appended bytes whenever the file changes; the log
    // is append-only so the previous size is always a valid resume offset.
    yield* Effect.callback<void>(() => {
      const close = Tail.follow(FILE, Buffer.byteLength(text))
      return Effect.sync(close)
    })
  }),
})
