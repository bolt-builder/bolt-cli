import { expect } from "bun:test"
import { Message, SystemPart } from "@opencode/ai/effect"
import { Agent } from "@opencode/core/agent"
import { Config } from "@opencode/core/config"
import { Document, Info } from "@opencode/schema/config"
import { Model } from "@opencode/core/model"
import { Provider } from "@opencode/core/provider"
import { Session } from "@opencode/core/session"
import { Plugin } from "@opencode/core/plugin"
import { PluginHost } from "@opencode/core/plugin/host"
import { PluginHooks } from "@opencode/core/plugin/hooks"
import { RedactPlugin } from "@opencode/core/plugin/redact"
import type { SessionHooks } from "@opencode/plugin/effect/session"
import { Effect, Schema } from "effect"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "./fixture"

const it = testEffect(PluginTestLayer)
const token = "ghp_abcdefghijklmnopqrstuvwxyz012345"
const request = (): SessionHooks["context"] => ({
  sessionID: Session.ID.make("ses_redact"),
  agent: Agent.ID.make("ask"),
  model: Model.Ref.make({ providerID: Provider.ID.make("fixture"), id: Model.ID.make("model") }),
  system: [SystemPart.make(`Credential ${token}`)],
  messages: [Message.user(`Evidence ${token}`)],
  options: {},
  tools: {},
})

it.effect("redacts V2 message classes for every generation hook without modifying stored messages", () =>
  Effect.gen(function* () {
    const plugins = yield* Plugin.Service
    const hooks = yield* PluginHooks.Service
    yield* RedactPlugin.Plugin.effect(yield* PluginHost.make(plugins, "test"))
    for (const kind of ["context", "compaction", "generate", "title"] as const) {
      const event = request()
      const original = event.messages[0]
      yield* hooks.trigger("session", kind, event)
      expect(event.system[0]?.text).toBe("Credential [redacted:github-token]")
      expect(event.messages[0]).toBeInstanceOf(Message)
      expect(event.messages[0]?.content).toEqual([{ type: "text", text: "Evidence [redacted:github-token]" }])
      expect(original?.content).toEqual([{ type: "text", text: `Evidence ${token}` }])
    }
  }),
)

it.effect("honors the legacy opt-out and experimental override across config layers", () =>
  Effect.gen(function* () {
    const plugins = yield* Plugin.Service
    const hooks = yield* PluginHooks.Service
    const config = yield* Config.Test
    yield* RedactPlugin.Plugin.effect(yield* PluginHost.make(plugins, "test"))
    for (const [settings, redacted] of [
      [[{ redact: false }], false],
      [[{ experimental: { redact: false } }], false],
      [[{ redact: false, experimental: { redact: true } }], true],
      [[{ redact: false }, { experimental: { todo: true } }], false],
      [[{ experimental: { redact: false } }, { redact: true }], true],
    ] as const) {
      yield* config.setEntries(
        settings.map(
          (input) => new Document({ type: "document", info: Schema.decodeUnknownSync(Info)(input) }),
        ),
      )
      const event = request()
      yield* hooks.trigger("session", "context", event)
      expect(event.messages[0]?.content).toEqual([
        { type: "text", text: `Evidence ${redacted ? "[redacted:github-token]" : token}` },
      ])
    }
  }),
)
