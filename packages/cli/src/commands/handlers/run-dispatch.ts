import { Effect, Option } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"

export default Runtime.handler(Commands.commands.run, (input) =>
  Effect.gen(function* () {
    if (input.mini) {
      const { active } = yield* Effect.promise(() => import("../../run/controls"))
      const { reportRunError } = yield* Effect.promise(() => import("../../run/run"))
      if (
        active({
          json: input.json,
          porcelain: input.porcelain,
          retries: input.retries,
          autoAgent: input.autoAgent,
          costReport: input.costReport,
          emit: Option.getOrUndefined(input.emit),
          maxCost: Option.getOrUndefined(input.maxCost),
          maxTokens: Option.getOrUndefined(input.maxTokens),
          timeout: Option.getOrUndefined(input.timeout),
          outputSchema: Option.getOrUndefined(input.outputSchema),
        }) ||
        input.format !== "default" ||
        Option.isSome(input.bestOf) ||
        Option.isSome(input.worktree) ||
        input.background ||
        input.voice
      )
        return reportRunError(
          input,
          "--mini cannot be combined with headless run controls, --best-of, --worktree, --background or --voice",
        )
      const handler = yield* Effect.promise(() => import("./mini"))
      const separator = process.argv.indexOf("--", 2)
      const prompt = [...input.message, ...(separator === -1 ? [] : process.argv.slice(separator + 1))].join(" ")
      return yield* handler.default({
        ...input,
        replay: input.replay,
        replayLimit: input.replayLimit,
        prompt: prompt ? Option.some(prompt) : Option.none(),
        demo: input.demo,
      })
    }
    const handler = yield* Effect.promise(() => import("./run"))
    return yield* handler.default(input)
  }),
)
