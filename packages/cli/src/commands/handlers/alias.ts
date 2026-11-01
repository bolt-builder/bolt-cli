import { Effect, Option } from "effect"
import { Global } from "@opencode/util/global"
import { Config } from "../../config"
import { CliAlias } from "../../services/alias"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"

export default Runtime.handler(
  Commands.commands.alias,
  Effect.fn("cli.alias")(function* (args) {
    const config = yield* Config.Service
    const global = yield* Global.Service
    const known = CliAlias.load(process.cwd(), global.config, (yield* config.get()).alias)
    const entry = Option.getOrUndefined(args.entry)
    const println = (text: string) => process.stdout.write(text + "\n")
    if (entry === undefined) {
      if (args.rm)
        return yield* Effect.fail(new Error("Pass the alias name to remove, e.g. bolt alias --rm deploy-check"))
      const entries = Object.entries(known).sort(([a], [b]) => a.localeCompare(b))
      if (!entries.length) println('No aliases defined. Set one with: bolt alias name="run ..."')
      for (const [name, value] of entries) println(`${name}=${JSON.stringify(value)}`)
      return
    }
    const split = entry.indexOf("=")
    const name = split === -1 ? entry : entry.slice(0, split)
    if (!/^[A-Za-z0-9][\w-]*$/.test(name)) return yield* Effect.fail(new Error(`Invalid alias name "${name}"`))
    if (args.rm || split === -1) {
      if (!Object.hasOwn(known, name)) return yield* Effect.fail(new Error(`No alias named "${name}"`))
      if (!args.rm) {
        println(`${name}=${JSON.stringify(known[name])}`)
        return
      }
      const current = yield* config.get()
      const project = CliAlias.load(process.cwd(), global.config, {}, true)
      if (Object.hasOwn(project, name) || current.alias?.[name] === undefined)
        return yield* Effect.fail(
          new Error(`Alias "${name}" is defined in a project or legacy configuration; remove it from that file`),
        )
      yield* config.update((draft) => {
        delete draft.alias?.[name]
      })
      println(`Removed alias ${name}`)
      return
    }
    const value = entry.slice(split + 1)
    if (!value.trim()) return yield* Effect.fail(new Error("Alias expansion cannot be empty"))
    if (name === "alias") return yield* Effect.fail(new Error('"alias" cannot be aliased'))
    yield* config.update((draft) => {
      draft.alias ??= {}
      draft.alias[name] = value
    })
    println(`${name}=${JSON.stringify(value)}`)
    println(`Saved to ${config.path}`)
  }),
)
