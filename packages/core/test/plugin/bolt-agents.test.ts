import { expect } from "bun:test"
import { Effect } from "effect"
import { Agent } from "@opencode/core/agent"
import { Bus } from "@opencode/core/bus"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { AgentPlugin } from "@opencode/core/plugin/agent"
import { Permission } from "@opencode/core/permission"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { testEffect } from "../lib/effect"
import { agentHost, host } from "./host"

const it = testEffect(AppNodeBuilder.build(LayerNode.group([Agent.node, Bus.node, FSUtil.node, Global.node])))

it.effect("registers Bolt specialist agents and preserves their V1 execution restrictions", () =>
  Effect.gen(function* () {
    const agents = yield* Agent.Service
    yield* AgentPlugin.Plugin.effect(
      host({ agent: agentHost(agents), session: { hook: () => Effect.succeed({ dispose: Effect.void }) } }),
    )
    for (const id of [
      "code",
      "ask",
      "commit",
      "code-review",
      "debug",
      "refactor",
      "docs",
      "security",
      "migrate",
      "perf",
    ]) {
      const agent = yield* agents.get(Agent.ID.make(id))
      expect(agent?.mode).toBe("primary")
      if (id !== "code") expect(agent?.system?.length).toBeGreaterThan(20)
    }
    for (const id of ["ask", "code-review", "security"]) {
      const agent = yield* agents.get(Agent.ID.make(id))
      if (!agent) throw new Error(`Missing ${id}`)
      for (const action of ["edit", "shell", "subagent"]) {
        expect(Permission.evaluate(action, "*", agent.permissions).effect).toBe("deny")
      }
      expect(Permission.evaluate("read", "src/main.ts", agent.permissions).effect).toBe("allow")
      expect(Permission.evaluate("read", ".env", agent.permissions).effect).toBe("ask")
    }
    for (const id of ["debug", "refactor", "migrate", "perf"]) {
      const agent = yield* agents.get(Agent.ID.make(id))
      if (!agent) throw new Error(`Missing ${id}`)
      expect(Permission.evaluate("edit", "src/main.ts", agent.permissions).effect).toBe("allow")
      expect(Permission.evaluate("subagent", "general", agent.permissions).effect).toBe("allow")
      expect(Permission.evaluate("subagent", "explore", agent.permissions).effect).toBe("deny")
    }
    const commit = yield* agents.get(Agent.ID.make("commit"))
    expect(commit?.hidden).toBe(true)
    expect(Permission.evaluate("read", "src/main.ts", commit!.permissions).effect).toBe("deny")
    expect((yield* agents.select()).id).toBe(Agent.defaultID)
  }),
)
