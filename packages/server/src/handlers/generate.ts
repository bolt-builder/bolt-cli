import { Generate } from "@bolt-ai/core/generate"
import { Location } from "@bolt-ai/core/location"
import { LocationServiceMap } from "@bolt-ai/core/location-services"
import { AbsolutePath } from "@bolt-ai/core/schema"
import { InvalidRequestError, ServiceUnavailableError } from "@bolt-ai/protocol/errors"
import { Global } from "@bolt-ai/util/global"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api"
import { awaitPlugins, locationErrors } from "../location"

export const GenerateHandler = HttpApiBuilder.group(Api, "server.generate", (handlers) =>
  Effect.gen(function* () {
    const global = yield* Global.Service
    const locations = yield* LocationServiceMap.Service
    const services = locations.get(Location.Ref.make({ directory: AbsolutePath.make(global.config) }))
    return handlers.handle(
      "generate.text",
      Effect.fn("server.generate.text")(
        function* (request) {
          yield* awaitPlugins
          const generate = yield* Generate.Service
          const text = yield* generate
            .text(request.payload)
            .pipe(
              Effect.mapError((error) =>
                error._tag === "Generate.ModelSelectionError"
                  ? new InvalidRequestError({ message: error.message })
                  : new ServiceUnavailableError({ message: error.message, service: error.service }),
              ),
            )
          return { data: { text } }
        },
        Effect.provide(services),
        locationErrors,
      ),
    )
  }),
)
