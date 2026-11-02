import { V1Migration } from "@opencode/core/database/v1-migration"
import { HttpApiBuilder } from "effect/http-api"
import { Effect } from "effect"
import { Global } from "@opencode/util/global"
import { Api } from "../api"

export const MigrationHandler = HttpApiBuilder.group(
  Api,
  "server.migration",
  Effect.fn(function* (handlers) {
    const global = yield* Global.Service
    return handlers.handle(
      "migration.v1.status",
      Effect.fn(function* () {
        return yield* V1Migration.status().pipe(Effect.provideService(Global.Service, global))
      }),
    )
  }),
)
