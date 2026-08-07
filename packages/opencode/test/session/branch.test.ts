import { describe, expect, test } from "bun:test"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { Effect, Layer } from "effect"
import { Session as SessionNs } from "@/session/session"
import { MessageV2 } from "@/session/message-v2"
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
import type { Provider } from "@/provider/provider"

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

const model = {
  id: "test-model",
  providerID: "test",
  name: "Test",
  limit: { context: 100_000, output: 32_000 },
  cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
  capabilities: {
    toolcall: true,
    attachment: false,
    reasoning: false,
    temperature: true,
    input: { text: true, image: false, audio: false, video: false },
    output: { text: true, image: false, audio: false, video: false },
  },
  api: { npm: "@ai-sdk/anthropic" },
  options: {},
} as Provider.Model

function id(value: string) {
  return { info: { id: MessageID.make(value) } }
}

describe("session.branch.boundary", () => {
  test("copies the full history without an anchor", () => {
    expect(SessionBranch.boundary([id("msg_a"), id("msg_b")])).toEqual({ fork: undefined })
  })

  test("returns the message after the anchor as fork boundary", () => {
    const messages = [id("msg_a"), id("msg_b"), id("msg_c")]
    expect(SessionBranch.boundary(messages, MessageID.make("msg_b"))).toEqual({ fork: MessageID.make("msg_c") })
  })

  test("copies the full history when anchored at the last message", () => {
    const messages = [id("msg_a"), id("msg_b")]
    expect(SessionBranch.boundary(messages, MessageID.make("msg_b"))).toEqual({ fork: undefined })
  })

  test("returns undefined for an unknown anchor", () => {
    expect(SessionBranch.boundary([id("msg_a")], MessageID.make("msg_x"))).toBeUndefined()
  })
})

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

describe("session.branch", () => {
  it.instance("branch shares a byte-identical model-visible prefix", () =>
    Effect.gen(function* () {
      const ssn = yield* SessionNs.Service
      const session = yield* ssn.create()
      const anchor = yield* turn(session.id, "first prompt", "first reply")
      yield* turn(session.id, "second prompt", "second reply")

      const messages = yield* ssn.messages({ sessionID: session.id })
      expect(messages).toHaveLength(4)
      const split = SessionBranch.boundary(messages, anchor.id)
      expect(split).toBeDefined()

      const branch = yield* ssn.fork({ sessionID: session.id, messageID: split!.fork })
      const branched = yield* ssn.messages({ sessionID: branch.id })
      expect(branched).toHaveLength(2)

      // The branch must present the model the exact same prefix as the parent
      // so provider prompt caches shared with the parent keep hitting.
      const parentPrefix = yield* MessageV2.toModelMessagesEffect(messages.slice(0, 2), model)
      const branchPrefix = yield* MessageV2.toModelMessagesEffect(branched, model)
      expect(branchPrefix).toEqual(parentPrefix)
    }),
  )
})
