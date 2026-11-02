export * as CoverageTool from "./coverage.js"

import type { Context } from "@opencode/plugin/effect/plugin"
import { ToolFailure } from "@opencode/ai/effect"
import { Effect, Schema } from "effect"
import path from "node:path"
import { Environment } from "../../environment/index.js"
import { FileAccess } from "../../file-access.js"
import { Location } from "../../location.js"
import { Permission } from "../../permission.js"
import { Ripgrep } from "../../ripgrep.js"
import DESCRIPTION from "./coverage.txt"

const MATCH_LIMIT = 10
const SEARCH_LIMIT = 1000

export type Entry = {
  file: string
  tests: string[]
}

/** Build the glob pattern matching conventional test files for a source file. */
export function pattern(file: string) {
  const base = path.basename(file, path.extname(file))
  if (!base) return undefined
  return `**/{${base}.test,${base}.spec,${base}_test,test_${base}}.*`
}

/** Drop dependency and VCS internals from glob matches. */
export function relevant(matches: string[]) {
  return matches.filter((match) => {
    const segments = match.split(/[\\/]/)
    return !segments.includes("node_modules") && !segments.includes(".git")
  })
}

/** Render the per-file coverage report shown to the agent. */
export function render(entries: Entry[]) {
  const covered = entries.filter((entry) => entry.tests.length > 0)
  const lines = entries.flatMap((entry) => {
    if (entry.tests.length === 0) return [`untested ${entry.file}`]
    return [
      `covered ${entry.file} (${entry.tests.length} test file${entry.tests.length === 1 ? "" : "s"})`,
      ...entry.tests.map((test) => `  ${test}`),
    ]
  })
  return [
    `${covered.length}/${entries.length} files have tests.`,
    "",
    ...lines,
    "",
    "Prefer changes in covered files. For untested files, plan to add tests first or flag the missing coverage in your handoff.",
  ].join("\n")
}

export const Input = Schema.Struct({
  files: Schema.Array(Schema.String)
    .check(Schema.isMinLength(1))
    .annotate({ description: "Source files to check, relative to the active project." }),
})
const Output = Schema.Struct({
  entries: Schema.Array(Schema.Struct({ file: Schema.String, tests: Schema.Array(Schema.String) })),
  truncated: Schema.Boolean,
})

export const Plugin = {
  id: "bolt.tool.coverage",
  effect: Effect.fn("CoverageTool.Plugin")(function* (ctx: Context) {
    const access = yield* FileAccess.Service
    const environment = yield* Environment.Service
    const location = yield* Location.Service
    const permission = yield* Permission.Service
    const ripgrep = yield* Ripgrep.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name: "coverage",
          options: { codemode: false },
          description: DESCRIPTION,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              const entries: Entry[] = []
              let truncated = false
              for (const file of input.files) {
                const target = yield* access.authorizeRead(file, context)
                const type = yield* Environment.typeFollowing(environment.files, target.absolute).pipe(
                  Effect.catchTag("Environment.NotFound", () => Effect.fail(new Error(`No such file: ${file}`))),
                )
                if (type !== "file") return yield* Effect.fail(new Error(`Not a source file: ${file}`))
                const glob = pattern(file)
                if (!glob) {
                  entries.push({ file, tests: [] })
                  continue
                }
                yield* permission.assert({
                  action: "glob",
                  resources: [glob],
                  save: ["*"],
                  sessionID: context.sessionID,
                  agent: context.agent,
                  source: { type: "tool", messageID: context.messageID, id: context.id },
                  metadata: { root: location.directory },
                })
                const matches = yield* ripgrep
                  .glob({ cwd: location.directory, pattern: glob, limit: SEARCH_LIMIT + 1, hidden: false })
                  .pipe(Effect.timeout("10 seconds"))
                truncated ||= matches.length > SEARCH_LIMIT
                entries.push({
                  file,
                  tests: relevant(matches.slice(0, SEARCH_LIMIT).map((entry) => entry.path))
                    .sort()
                    .slice(0, MATCH_LIMIT),
                })
              }
              const covered = entries.filter((entry) => entry.tests.length > 0).length
              return {
                output: { entries, truncated },
                content: [
                  {
                    type: "text" as const,
                    text:
                      render(entries) +
                      (truncated
                        ? "\n\nTest search was truncated at 1000 matches per source; listed matches may be incomplete."
                        : ""),
                  },
                ],
                metadata: { covered, untested: entries.length - covered, truncated },
              }
            }).pipe(Effect.mapError((error) => new ToolFailure({ message: "Unable to inspect test coverage", error }))),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
