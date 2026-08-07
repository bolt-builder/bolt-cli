import { describe, expect } from "bun:test"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { Effect, Layer } from "effect"
import { Session as SessionNs } from "@/session/session"
import { SessionBranch } from "@/session/branch"
import { MessageID, PartID, type SessionID } from "@/session/schema"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { testEffect } from "../lib/effect"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { EventV2Bridge } from "@/event-v2-bridge"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { InstanceStore } from "@/project/instance-store"
import { InstanceBootstrap } from "@/project/bootstrap"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"

const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([
      SessionNs.node,
      EventV2Bridge.node,
      SessionProjector.node,
      CrossSpawnSpawner.node,
      InstanceStore.node,
    ]),
    [
      [RuntimeFlags.node, RuntimeFlags.layer({ experimentalWorkspaces: false })],
      [
        InstanceBootstrap.node,
        Layer.succeed(InstanceBootstrap.Service, InstanceBootstrap.Service.of({ run: Effect.void })),
      ],
    ],
  ),
)

const ref = {
  providerID: ProviderV2.ID.make("test"),
  modelID: ModelV2.ID.make("test-model"),
}

function turn(sessionID: SessionID, prompt: string, reply: string) {
  return Effect.gen(function* () {
    const ssn = yield* SessionNs.Service
    const user = yield* ssn.updateMessage({
      id: MessageID.ascending(),
      role: "user",
      sessionID,
      agent: "build",
      model: ref,
      time: { created: Date.now() },
    })
    yield* ssn.updatePart({
      id: PartID.ascending(),
      messageID: user.id,
      sessionID,
      type: "text",
      text: prompt,
    })
    const assistant = yield* ssn.updateMessage({
      id: MessageID.ascending(),
      role: "assistant",
      sessionID,
      mode: "build",
      agent: "build",
      path: { cwd: "/", root: "/" },
      cost: 0,
      tokens: { output: 0, input: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      modelID: ref.modelID,
      providerID: ref.providerID,
      parentID: user.id,
      time: { created: Date.now() },
      finish: "end_turn",
    })
    yield* ssn.updatePart({
      id: PartID.ascending(),
      messageID: assistant.id,
      sessionID,
      type: "text",
      text: reply,
    })
    return assistant
  })
}

// The `bolt fork` command path: boundary(messages, anchor) -> fork. The fork
// keeps history through the anchor and then diverges without touching the
// parent session.
describe("cli.fork", () => {
  it.instance("forks at a message and diverges independently", () =>
    Effect.gen(function* () {
      const ssn = yield* SessionNs.Service
      const session = yield* ssn.create()
      const anchor = yield* turn(session.id, "first prompt", "first reply")
      yield* turn(session.id, "second prompt", "second reply")

      const messages = yield* ssn.messages({ sessionID: session.id })
      const split = SessionBranch.boundary(messages, anchor.id)
      expect(split).toBeDefined()

      const fork = yield* ssn.fork({ sessionID: session.id, messageID: split!.fork })
      expect(fork.id).not.toBe(session.id)
      expect(fork.title).toContain("fork #1")

      const forked = yield* ssn.messages({ sessionID: fork.id })
      expect(forked).toHaveLength(2)

      // Continue the fork down a different path; the parent stays untouched.
      yield* turn(fork.id, "different path", "different reply")
      expect(yield* ssn.messages({ sessionID: fork.id })).toHaveLength(4)
      expect(yield* ssn.messages({ sessionID: session.id })).toHaveLength(4)
    }),
  )

  it.instance("forks the full history without an anchor", () =>
    Effect.gen(function* () {
      const ssn = yield* SessionNs.Service
      const session = yield* ssn.create()
      yield* turn(session.id, "first prompt", "first reply")
      yield* turn(session.id, "second prompt", "second reply")

      const messages = yield* ssn.messages({ sessionID: session.id })
      const split = SessionBranch.boundary(messages)
      expect(split).toEqual({ fork: undefined })

      const fork = yield* ssn.fork({ sessionID: session.id, messageID: split!.fork })
      expect(yield* ssn.messages({ sessionID: fork.id })).toHaveLength(4)
    }),
  )
})
