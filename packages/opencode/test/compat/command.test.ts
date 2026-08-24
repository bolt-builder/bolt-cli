import { describe, expect } from "bun:test"
import path from "path"
import { Effect } from "effect"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { LayerNodePlatform } from "@opencode-ai/core/effect/app-node-platform"
import { CompatCommand } from "@/compat/command"
import { tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([CrossSpawnSpawner.node, LayerNodePlatform.filesystem, FSUtil.node])),
)

const setup = (files: Record<string, string>) =>
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const dir = yield* tmpdirScoped()
    const home = yield* tmpdirScoped()
    for (const [file, content] of Object.entries(files)) {
      yield* fs.writeWithDirs(path.join(dir, file), content)
    }
    return { fs, dir, home }
  })

describe("CompatCommand.discover", () => {
  it.effect("imports commands and workflows with frontmatter mapping", () =>
    Effect.gen(function* () {
      const { fs, dir, home } = yield* setup({
        ".claude/commands/commit.md":
          "---\ndescription: Create a commit\nargument-hint: message\n---\nCommit with $ARGUMENTS",
        ".kilocode/workflows/release.md": "Run the release workflow",
        ".windsurf/workflows/deploy.md": "---\ndescription: Deploy\n---\nDeploy now",
      })
      const found = yield* CompatCommand.discover(fs, { directory: dir, worktree: dir, home })
      expect(found).toEqual({
        commit: { template: "Commit with $ARGUMENTS", description: "Create a commit" },
        release: { template: "Run the release workflow" },
        deploy: { template: "Deploy now", description: "Deploy" },
      })
    }),
  )

  it.effect("keeps nested names and drops unqualified models", () =>
    Effect.gen(function* () {
      const { fs, dir, home } = yield* setup({
        ".claude/commands/git/commit.md": "---\nmodel: sonnet\n---\nnested body",
        ".cursor/commands/qualified.md": "---\nmodel: anthropic/claude-sonnet-4-5\n---\nqualified body",
      })
      const found = yield* CompatCommand.discover(fs, { directory: dir, worktree: dir, home })
      expect(found).toEqual({
        "git/commit": { template: "nested body" },
        qualified: { template: "qualified body", model: "anthropic/claude-sonnet-4-5" },
      })
    }),
  )

  it.effect("first definition wins on name collisions and empty bodies are skipped", () =>
    Effect.gen(function* () {
      const { fs, dir, home } = yield* setup({
        ".claude/commands/shared.md": "claude body",
        ".cursor/commands/shared.md": "cursor body",
        ".roo/commands/empty.md": "---\ndescription: nothing\n---\n",
      })
      const found = yield* CompatCommand.discover(fs, { directory: dir, worktree: dir, home })
      expect(found).toEqual({ shared: { template: "claude body" } })
    }),
  )

  it.effect("imports global codex prompts from home", () =>
    Effect.gen(function* () {
      const { fs, dir, home } = yield* setup({})
      yield* fs.writeWithDirs(path.join(home, ".codex", "prompts", "review.md"), "Review this")
      const found = yield* CompatCommand.discover(fs, { directory: dir, worktree: dir, home })
      expect(found).toEqual({ review: { template: "Review this" } })
    }),
  )
})
