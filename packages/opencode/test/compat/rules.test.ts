import { describe, expect } from "bun:test"
import path from "path"
import { Effect } from "effect"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { LayerNodePlatform } from "@opencode-ai/core/effect/app-node-platform"
import { CompatRules } from "@/compat/rules"
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
    const entries = yield* CompatRules.discover(fs, { directory: dir, worktree: dir })
    return { dir, entries }
  })

describe("CompatRules.discover", () => {
  it.effect("discovers plain rules files from many tools", () =>
    Effect.gen(function* () {
      const { dir, entries } = yield* setup({
        ".cursorrules": "cursor root rules",
        ".github/copilot-instructions.md": "copilot rules",
        ".kilocode/rules/style.md": "kilo style",
        ".roo/rules/style.md": "roo style",
        ".clinerules": "cline rules",
        "GEMINI.md": "gemini memory",
        ".rules": "zed rules",
        ".junie/guidelines.md": "junie guidelines",
      })
      const byPath = Object.fromEntries(entries.map((entry) => [path.relative(dir, entry.path), entry.content]))
      expect(byPath).toEqual({
        ".cursorrules": "cursor root rules",
        ".github/copilot-instructions.md": "copilot rules",
        ".kilocode/rules/style.md": "kilo style",
        ".roo/rules/style.md": "roo style",
        ".clinerules": "cline rules",
        "GEMINI.md": "gemini memory",
        ".rules": "zed rules",
        ".junie/guidelines.md": "junie guidelines",
      })
    }),
  )

  it.effect("dedupes identical content across tools", () =>
    Effect.gen(function* () {
      const { entries } = yield* setup({
        "GEMINI.md": "shared rules",
        "QWEN.md": "shared rules",
        ".windsurfrules": "windsurf only",
      })
      expect(entries.map((entry) => entry.content).sort()).toEqual(["shared rules", "windsurf only"])
    }),
  )

  it.effect("honors cursor .mdc frontmatter and strips it", () =>
    Effect.gen(function* () {
      const { dir, entries } = yield* setup({
        ".cursor/rules/always.mdc": "---\nalwaysApply: true\n---\nalways body",
        ".cursor/rules/manual.mdc": "---\nalwaysApply: false\n---\nmanual body",
        ".cursor/rules/scoped.mdc": "---\nglobs: '*.ts'\n---\nscoped body",
        ".cursor/rules/plain.md": "plain body",
      })
      const byPath = Object.fromEntries(entries.map((entry) => [path.relative(dir, entry.path), entry.content]))
      expect(byPath).toEqual({
        ".cursor/rules/always.mdc": "always body",
        ".cursor/rules/plain.md": "plain body",
      })
    }),
  )

  it.effect("honors windsurf trigger modes and strips frontmatter", () =>
    Effect.gen(function* () {
      const { dir, entries } = yield* setup({
        ".windsurf/rules/always.md": "---\ntrigger: always_on\n---\nalways body",
        ".windsurf/rules/manual.md": "---\ntrigger: manual\n---\nmanual body",
        ".windsurf/rules/scoped.md": "---\ntrigger: glob\nglobs: '*.ts'\n---\nscoped body",
        ".windsurf/rules/model.md": "---\ntrigger: model_decision\ndescription: when relevant\n---\nmodel body",
        ".windsurf/rules/plain.md": "plain body",
      })
      const byPath = Object.fromEntries(entries.map((entry) => [path.relative(dir, entry.path), entry.content]))
      expect(byPath).toEqual({
        ".windsurf/rules/always.md": "always body",
        ".windsurf/rules/plain.md": "plain body",
      })
    }),
  )

  it.effect("honors continue alwaysApply and globs scoping", () =>
    Effect.gen(function* () {
      const { dir, entries } = yield* setup({
        ".continue/rules/always.md": "---\nalwaysApply: true\n---\nalways body",
        ".continue/rules/manual.md": "---\nalwaysApply: false\n---\nmanual body",
        ".continue/rules/scoped.md": "---\nglobs: '**/*.ts'\n---\nscoped body",
        ".continue/rules/plain.md": "plain body",
      })
      const byPath = Object.fromEntries(entries.map((entry) => [path.relative(dir, entry.path), entry.content]))
      expect(byPath).toEqual({
        ".continue/rules/always.md": "always body",
        ".continue/rules/plain.md": "plain body",
      })
    }),
  )

  it.effect("honors kiro steering inclusion modes", () =>
    Effect.gen(function* () {
      const { dir, entries } = yield* setup({
        ".kiro/steering/default.md": "default steering",
        ".kiro/steering/always.md": "---\ninclusion: always\n---\nalways steering",
        ".kiro/steering/scoped.md": "---\ninclusion: fileMatch\nfileMatchPattern: '*.tsx'\n---\nscoped steering",
        ".kiro/steering/manual.md": "---\ninclusion: manual\n---\nmanual steering",
      })
      const byPath = Object.fromEntries(entries.map((entry) => [path.relative(dir, entry.path), entry.content]))
      expect(byPath).toEqual({
        ".kiro/steering/default.md": "default steering",
        ".kiro/steering/always.md": "always steering",
      })
    }),
  )

  it.effect("skips empty files", () =>
    Effect.gen(function* () {
      const { entries } = yield* setup({ ".cursorrules": "  \n", ".goosehints": "goose" })
      expect(entries.map((entry) => entry.content)).toEqual(["goose"])
    }),
  )

  it.effect("walks up from a nested directory to the worktree root", () =>
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const dir = yield* tmpdirScoped()
      yield* fs.writeWithDirs(path.join(dir, ".cursorrules"), "root rules")
      yield* fs.ensureDir(path.join(dir, "nested"))
      const entries = yield* CompatRules.discover(fs, { directory: path.join(dir, "nested"), worktree: dir })
      expect(entries.map((entry) => entry.content)).toEqual(["root rules"])
    }),
  )
})
