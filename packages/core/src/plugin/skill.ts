/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { define } from "./internal"
import { Effect } from "effect"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import boltConfigContent from "./skill/bolt-config.md" with { type: "text" }

export const BoltConfigContent = boltConfigContent

export const Plugin = define({
  id: "skill",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.skill.transform((draft) => {
      draft.source(
        SkillV2.EmbeddedSource.make({
          type: "embedded",
          skill: SkillV2.Info.make({
            name: "bolt-config",
            description:
              "Use ONLY when the user is editing or creating bolt's own configuration: bolt.json, bolt.jsonc, legacy opencode.json(c), files under .bolt/ or .opencode/, or files under ~/.config/opencode/. Also use when creating or fixing bolt agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring bolt itself.",
            location: AbsolutePath.make("/builtin/bolt-config.md"),
            content: BoltConfigContent,
          }),
        }),
      )
    })
  }),
})
