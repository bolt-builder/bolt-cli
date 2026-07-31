import { describe, expect } from "bun:test"
import path from "path"
import { Effect } from "effect"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { LayerNodePlatform } from "@opencode-ai/core/effect/app-node-platform"
import { CompatAgent } from "@/compat/agent"
import { tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([CrossSpawnSpawner.node, LayerNodePlatform.filesystem, FSUtil.node])),
)

const setup = (files: Record<string, string>) =>
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const dir = yield* tmpdirScoped()
    for (const [file, content] of Object.entries(files)) {
      yield* fs.writeWithDirs(path.join(dir, file), content)
    }
    const found = yield* CompatAgent.discover(fs, { directory: dir, worktree: dir })
    return found
  })

describe("CompatAgent.discover", () => {
  it.effect("maps yaml custom modes to primary agents with group-based denies", () =>
    Effect.gen(function* () {
      const found = yield* setup({
        ".roomodes": [
          "customModes:",
          "  - slug: docs-writer",
          "    name: Docs Writer",
          "    whenToUse: Writing documentation",
          "    roleDefinition: You write excellent docs.",
          "    customInstructions: Keep prose tight.",
          "    groups:",
          "      - read",
          "      - - edit",
          "        - fileRegex: '\\.md$'",
        ].join("\n"),
      })
      expect(found).toEqual({
        "docs-writer": {
          mode: "primary",
          prompt: "You write excellent docs.\n\nKeep prose tight.",
          description: "Writing documentation",
          permission: { bash: "deny", webfetch: "deny" },
        },
      })
    }),
  )

  it.effect("parses json modes and keeps default permissions without groups", () =>
    Effect.gen(function* () {
      const found = yield* setup({
        ".kilocodemodes": JSON.stringify({
          customModes: [{ slug: "reviewer", name: "Reviewer", roleDefinition: "You review code." }],
        }),
      })
      expect(found).toEqual({
        reviewer: { mode: "primary", prompt: "You review code.", description: "Reviewer" },
      })
    }),
  )

  it.effect("skips invalid slugs, empty prompts, and unparseable files", () =>
    Effect.gen(function* () {
      const found = yield* setup({
        ".roomodes": [
          "customModes:",
          "  - slug: 'bad slug!'",
          "    roleDefinition: Has an invalid slug.",
          "  - slug: empty",
          "    roleDefinition: ''",
          "  - slug: good",
          "    roleDefinition: Works.",
        ].join("\n"),
        ".kilocodemodes": "{{{not yaml or json",
      })
      expect(found).toEqual({ good: { mode: "primary", prompt: "Works." } })
    }),
  )
})
