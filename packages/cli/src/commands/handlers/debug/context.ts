import { ContextReplay } from "@opencode/util/context-replay"
import { Global } from "@opencode/util/global"
import { Effect, Option } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"

export default Runtime.handler(
  Commands.commands.debug.commands.context,
  Effect.fn("cli.debug.context")(function* (input) {
    const global = yield* Global.Service
    const bolt = Global.boltDirectory(global.data)
    yield* Effect.tryPromise(async () => {
      const entries = await ContextReplay.list(input.sessionID, [...(bolt ? [bolt] : []), global.data])
      if (!entries.length)
        throw new Error(
          `No recorded context for session ${input.sessionID}. Set experimental.context_replay to true to record requests.`,
        )
      if (Option.isNone(input.turn)) {
        for (const [index, entry] of entries.entries()) process.stdout.write(`${index + 1}  ${entry.name}\n`)
        return
      }
      const entry = input.turn.value > 0 ? entries[input.turn.value - 1] : undefined
      if (!entry) throw new Error(`Turn ${input.turn.value} not found (${entries.length} recorded)`)
      process.stdout.write(JSON.stringify(await ContextReplay.load(input.sessionID, entry), null, 2) + "\n")
    })
  }),
)
