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
    const visible = (yield* agents.list()).filter((agent) => !agent.hidden)
    expect(visible.map((agent) => String(agent.id)).sort()).toEqual([
      "ask",
      "bug-hunter",
      "build",
      "code",
      "code-review",
      "debug",
      "debugger",
      "docs",
      "documentation",
      "explore",
      "general",
      "migrate",
      "perf",
      "refactor",
      "reviewer",
      "security",
      "security-auditor",
      "security-fixer",
    ])
    for (const id of ["ask", "code-review", "debug", "docs", "explore", "migrate", "perf", "refactor", "security"]) {
      expect((yield* agents.get(Agent.ID.make(id)))?.system?.length).toBeGreaterThan(20)
    }
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
      for (const action of ["edit", "shell", "test_run", "http", "profile", "frames", "subagent"]) {
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
    for (const id of ["reviewer", "security-auditor", "debugger", "documentation", "bug-hunter", "security-fixer"]) {
      const agent = yield* agents.get(Agent.ID.make(id))
      if (!agent) throw new Error(`Missing ${id}`)
      expect(agent.mode).toBe("subagent")
      expect(agent.system?.length).toBeGreaterThan(20)
      expect(Permission.evaluate("subagent", "*", agent.permissions).effect).toBe("deny")
      expect(Permission.evaluate("edit", "src/main.ts", agent.permissions).effect).toBe(
        id === "reviewer" || id === "security-auditor" ? "deny" : "allow",
      )
    }
    const commit = yield* agents.get(Agent.ID.make("commit"))
    expect(commit?.hidden).toBe(true)
    expect(Permission.evaluate("read", "src/main.ts", commit!.permissions).effect).toBe("deny")
    expect((yield* agents.select()).id).toBe(Agent.defaultID)
  }),
)
