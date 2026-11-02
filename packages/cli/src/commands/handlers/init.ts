import path from "node:path"
import { existsSync } from "node:fs"
import { Effect, Option } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
export type Preset = {
  description: string
  config: Record<string, unknown>
  agents: Record<string, string>
  commands: Record<string, string>
}

const library: Preset = {
  description: "a published package with a public API",
  config: {},
  agents: {
    "api-review": [
      "---",
      "description: Reviews public API changes for backward compatibility and semver impact",
      "mode: subagent",
      "---",
      "",
      "You review changes to this library's public API surface. Inspect exported types, functions,",
      "and classes touched by the diff. Flag breaking changes (removed or renamed exports, narrowed",
      "types, changed signatures), and state whether the change is a patch, minor, or major bump",
      "under semver. Suggest deprecation paths instead of removals when possible.",
      "",
    ].join("\n"),
  },
  commands: {
    "release-notes": [
      "---",
      "description: Draft release notes from recent commits",
      "---",
      "",
      "Draft concise release notes grouped into Features, Fixes, and Breaking Changes",
      "based on these commits:",
      "",
      "!`git log --oneline -30`",
      "",
    ].join("\n"),
  },
}

const webapp: Preset = {
  description: "a user-facing web application",
  config: {},
  agents: {
    "ui-review": [
      "---",
      "description: Reviews UI changes for accessibility, responsiveness, and UX consistency",
      "mode: subagent",
      "---",
      "",
      "You review user interface changes. Check accessibility (labels, contrast, keyboard",
      "navigation, focus management), responsive behavior, loading and error states, and",
      "consistency with the existing design patterns in this codebase. Report concrete issues",
      "with file and line references.",
      "",
    ].join("\n"),
  },
  commands: {
    "audit-a11y": [
      "---",
      "description: Audit current UI changes for accessibility issues",
      "---",
      "",
      "Audit the following UI changes for accessibility problems and suggest fixes:",
      "",
      "!`git diff HEAD`",
      "",
    ].join("\n"),
  },
}

const monorepo: Preset = {
  description: "multiple packages in one repository",
  config: {
    watcher: { ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"] },
  },
  agents: {
    "cross-package": [
      "---",
      "description: Reviews changes for cross-package impact inside the monorepo",
      "mode: subagent",
      "---",
      "",
      "You review changes in a monorepo for cross-package impact. For each modified package,",
      "find dependent packages and check whether shared types, APIs, or build outputs still line",
      "up. Flag changes that require coordinated updates in sibling packages and list the exact",
      "files that need them.",
      "",
    ].join("\n"),
  },
  commands: {
    affected: [
      "---",
      "description: List packages affected by the current changes",
      "---",
      "",
      "Given the changed files below, list the packages they belong to and every package that",
      "depends on them, directly or transitively:",
      "",
      "!`git diff --name-only HEAD`",
      "",
    ].join("\n"),
  },
}

export const PRESETS = { library, webapp, monorepo }

/** Seed config, agents, and commands into a project directory, never overwriting existing files. */
export async function seed(directory: string, preset?: Preset) {
  const created: string[] = []
  const skipped: string[] = []
  const write = async (target: string, content: string) => {
    if (existsSync(target)) {
      skipped.push(target)
      return
    }
    await Bun.write(target, content)
    created.push(target)
  }
  const config = { $schema: "https://bolt.ai/config.json", ...(preset?.config ?? {}) }
  await write(path.join(directory, "bolt.jsonc"), JSON.stringify(config, null, 2) + "\n")
  for (const [name, content] of Object.entries(preset?.agents ?? {})) {
    await write(path.join(directory, ".bolt", "agent", `${name}.md`), content)
  }
  for (const [name, content] of Object.entries(preset?.commands ?? {})) {
    await write(path.join(directory, ".bolt", "command", `${name}.md`), content)
  }
  return { created, skipped }
}

export default Runtime.handler(Commands.commands.init, (args) =>
  Effect.gen(function* () {
    const directory = path.resolve(Option.getOrElse(args.directory, () => process.cwd()))
    const preset = Option.isSome(args.preset) ? PRESETS[args.preset.value] : undefined
    const result = yield* Effect.tryPromise({ try: () => seed(directory, preset), catch: (cause) => cause })
    for (const file of result.created) process.stdout.write(`created ${path.relative(directory, file)}\n`)
    for (const file of result.skipped)
      process.stdout.write(`skipped ${path.relative(directory, file)} (already exists)\n`)
    if (preset && Option.isSome(args.preset))
      process.stdout.write(`Initialized for ${args.preset.value}: ${preset.description}.\n`)
  }),
)
