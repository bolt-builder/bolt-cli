import { expect } from "bun:test"
import { Effect } from "effect"
import { Agent } from "@opencode/core/agent"
import { Model } from "@opencode/core/model"
import { Provider } from "@opencode/core/provider"
import { Session } from "@opencode/core/session"
import { Plugin } from "@opencode/core/plugin"
import { PluginHost } from "@opencode/core/plugin/host"
import { PluginHooks } from "@opencode/core/plugin/hooks"
import { AgentPlugin } from "@opencode/core/plugin/agent"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "./fixture"

const it = testEffect(PluginTestLayer)
it.effect("uses the V1 commit temperature on V2 generation context only for the commit agent", () =>
  Effect.gen(function* () {
    const plugins = yield* Plugin.Service
    const hooks = yield* PluginHooks.Service
    yield* AgentPlugin.Plugin.effect(yield* PluginHost.make(plugins, "test"))
    const base = {
      sessionID: Session.ID.make("ses_agent_temperature"),
      model: Model.Ref.make({ providerID: Provider.ID.make("test"), id: Model.ID.make("model") }),
      system: [],
      messages: [],
      options: {},
      tools: {},
    }
    expect(
      (yield* hooks.trigger("session", "context", { ...base, agent: Agent.ID.make("commit") })).options.temperature,
    ).toBe(0.3)
    expect(
      (yield* hooks.trigger("session", "context", { ...base, options: {}, agent: Agent.ID.make("build") })).options
        .temperature,
    ).toBeUndefined()
  }),
)
