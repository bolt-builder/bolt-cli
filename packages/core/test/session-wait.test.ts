import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Database } from "@bolt-ai/core/database/database"
import { AppNodeBuilder } from "@bolt-ai/core/effect/app-node-builder"
import { LayerNode } from "@bolt-ai/util/effect/layer-node"
import { Bus } from "@bolt-ai/core/bus"
import { Location } from "@bolt-ai/core/location"
import { Project } from "@bolt-ai/core/project"
import { AbsolutePath } from "@bolt-ai/core/schema"
import { Session } from "@bolt-ai/core/session"
import { SessionProjector } from "@bolt-ai/core/session/projector"
import { SessionExecution } from "@bolt-ai/core/session/execution"
import { SessionStore } from "@bolt-ai/core/session/store"
import { testEffect } from "./lib/effect"
import { globalProjectNode } from "./lib/project"

const location = Location.Ref.make({ directory: AbsolutePath.make("/project") })
const awaited: Session.ID[] = []
const execution = Layer.mock(SessionExecution.Service, {
  awaitIdle: (sessionID) => Effect.sync(() => awaited.push(sessionID)),
})
const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([Database.node, Bus.node, SessionProjector.node, SessionStore.node, Session.node]),
    [Project.node.replace(globalProjectNode), SessionExecution.node.replace(execution)],
  ),
)

describe("Session.wait", () => {
  it.effect("delegates to SessionExecution.awaitIdle", () =>
    Effect.gen(function* () {
      awaited.length = 0
      const sessions = yield* Session.Service
      const session = yield* sessions.create({ location })

      yield* sessions.wait(session.id)

      expect(awaited).toEqual([session.id])
    }),
  )
})
