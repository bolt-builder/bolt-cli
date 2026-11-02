import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { entries, leaves, resolved } from "./shared"
export default Runtime.handler(Commands.commands.config.commands.doctor, () =>
  Effect.gen(function* () {
    const sources = yield* entries()
    process.stdout.write("Config sources in load order (later sources win):\n")
    sources.forEach((source, index) =>
      process.stdout.write(
        `  ${index + 1}. ${source.path ?? "(runtime document)"}${
          source.type === "directory"
            ? " (discovery directory)"
            : `\n     sets: ${
                Object.keys(source.info)
                  .filter((key) => key !== "$schema")
                  .join(", ") || "(nothing)"
              }`
        }\n`,
      ),
    )
    if (!sources.length) process.stdout.write("  (no config sources loaded)\n")
    process.stdout.write("\nWinning source per key:\n")
    const winners = new Map<string, string>()
    for (const source of sources)
      if (source.type === "document")
        for (const key of leaves(source.info)) winners.set(key, source.path ?? "(runtime document)")
    for (const key of leaves(resolved(sources))
      .filter((key) => key !== "$schema")
      .sort())
      process.stdout.write(`  ${key} <- ${winners.get(key) ?? "(runtime default)"}\n`)
    for (const key of ["instructions", "permissions", "policies", "plugins"]) {
      const contributors = sources.filter(
        (source) => source.type === "document" && source.info[key as keyof typeof source.info] !== undefined,
      )
      if (contributors.length > 1)
        process.stdout.write(
          `\nNote: "${key}" accumulates across sources:\n${contributors.map((source) => `  ${source.path ?? "(runtime document)"}`).join("\n")}\n`,
        )
    }
  }),
)
