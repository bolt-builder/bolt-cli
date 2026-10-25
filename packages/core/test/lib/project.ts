import { Database } from "@bolt-ai/core/database/database"
import { Project } from "@bolt-ai/core/project"
import { upsertProject } from "@bolt-ai/core/project/sql"
import { makeGlobalNode } from "@bolt-ai/util/effect/app-node"
import { Effect, Layer } from "effect"

export const globalProjectNode = makeGlobalNode({
  service: Project.Service,
  layer: Layer.effect(
    Project.Service,
    Effect.gen(function* () {
      const database = yield* Database.Service
      return Project.Service.of({
        list: () => Effect.succeed([]),
        update: () => Effect.die("not implemented"),
        activate: () => Effect.void,
        sweep: () => Effect.void,
        resolve: (directory) => {
          const project = { id: Project.ID.global, directory, canonical: directory }
          return upsertProject(database.db, project).pipe(Effect.orDie, Effect.as(project))
        },
      })
    }),
  ),
  deps: [Database.node],
})
