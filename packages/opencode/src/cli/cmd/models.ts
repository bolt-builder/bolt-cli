import { EOL } from "os"
import { Effect } from "effect"
import { ModelsDev } from "@opencode-ai/core/models-dev"
import { effectCmd, fail } from "../effect-cmd"
import { UI } from "../ui"
import { Envelope } from "../envelope"
import { Porcelain } from "../porcelain"
import { ProviderV2 } from "@opencode-ai/core/provider"

export const ModelsCommand = effectCmd({
  command: "models [provider]",
  describe: "list all available models",
  builder: (yargs) =>
    yargs
      .positional("provider", {
        describe: "provider ID to filter models by",
        type: "string",
        array: false,
      })
      .option("verbose", {
        describe: "use more verbose model output (includes metadata like costs)",
        type: "boolean",
      })
      .option("refresh", {
        describe: "refresh the models cache from models.dev",
        type: "boolean",
      })
      .option("json", {
        describe: Envelope.DESCRIBE,
        type: "boolean",
        default: false,
      })
      .option("porcelain", {
        describe: Porcelain.DESCRIBE,
        type: "boolean",
        default: false,
      })
      .conflicts("porcelain", "verbose")
      .conflicts("porcelain", "json"),
  handler: Effect.fn("Cli.models")(function* (args) {
    const { Provider } = yield* Effect.promise(() => import("@/provider/provider"))
    if (args.refresh) {
      yield* ModelsDev.Service.use((s) => s.refresh(true))
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Models cache refreshed" + UI.Style.TEXT_NORMAL)
    }

    const provider = yield* Provider.Service
    const providers = yield* provider.list()

    const models = (providerID: ProviderV2.ID) => {
      const p = providers[providerID]
      return Object.entries(p.models)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([modelID, model]) => ({ id: `${providerID}/${modelID}`, model }))
    }

    // Collect plain lines instead of streaming so long lists page through $PAGER;
    // porcelain output stays streamed so scripted consumers never page.
    const output: string[] = []
    const print = (providerID: ProviderV2.ID, verbose?: boolean) => {
      for (const entry of models(providerID)) {
        if (args.porcelain) {
          Porcelain.print("model", entry.id)
          continue
        }
        output.push(entry.id)
        if (verbose) output.push(JSON.stringify(entry.model, null, 2))
      }
    }

    const { Pager } = yield* Effect.promise(() => import("../pager"))

    if (args.provider) {
      const providerID = ProviderV2.ID.make(args.provider)
      if (!providers[providerID]) return yield* fail(`Provider not found: ${args.provider}`)
      if (args.json) {
        Envelope.print(models(providerID).map((entry) => (args.verbose ? entry : { id: entry.id })))
        return
      }
      print(providerID, args.verbose)
      yield* Effect.promise(() => Pager.page(output.join(EOL)))
      return
    }

    const ids = Object.keys(providers).sort((a, b) => {
      const aIsOpencode = a.startsWith("opencode")
      const bIsOpencode = b.startsWith("opencode")
      if (aIsOpencode && !bIsOpencode) return -1
      if (!aIsOpencode && bIsOpencode) return 1
      return a.localeCompare(b)
    })

    if (args.json) {
      Envelope.print(
        ids.flatMap((providerID) =>
          models(ProviderV2.ID.make(providerID)).map((entry) => (args.verbose ? entry : { id: entry.id })),
        ),
      )
      return
    }

    for (const providerID of ids) print(ProviderV2.ID.make(providerID), args.verbose)
    yield* Effect.promise(() => Pager.page(output.join(EOL)))
  }),
})
