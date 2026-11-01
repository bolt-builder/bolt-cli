export * as SemanticSearchTool from "./semantic-search.js"

import path from "path"
import { Effect, Schema } from "effect"
import { ToolFailure } from "@opencode/ai/effect"
import type { Context } from "@opencode/plugin/effect/plugin"
import { SemanticRank } from "@opencode/util/semantic-rank"
import { Environment } from "../../environment/index.js"
import { FileAccess } from "../../file-access.js"
import { Location } from "../../location.js"
import { Permission } from "../../permission.js"
import { Ripgrep } from "../../ripgrep.js"
import { FileSystem } from "../../filesystem.js"

export const name = "semantic_search"
const MAX_FILES = 4000
const MAX_FILE_BYTES = 200_000
const extensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".go",
  ".rs",
  ".py",
  ".rb",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".h",
  ".cc",
  ".cpp",
  ".hpp",
  ".cs",
  ".php",
  ".scala",
  ".sh",
  ".bash",
  ".zig",
  ".lua",
  ".sql",
  ".html",
  ".css",
  ".scss",
  ".vue",
  ".svelte",
  ".md",
  ".yml",
  ".yaml",
  ".toml",
])
export const Input = Schema.Struct({
  query: Schema.String.check(Schema.isMinLength(1)).annotate({ description: "What to look for, described by meaning" }),
  path: Schema.optional(Schema.String).annotate({
    description: "Directory to search; defaults to the current location",
  }),
  limit: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))).annotate({
    description: "Maximum results (default: 8)",
  }),
})
export const Output = Schema.Array(
  Schema.Struct({
    file: Schema.String,
    start: Schema.Int,
    end: Schema.Int,
    score: Schema.Number,
    snippet: Schema.String,
  }),
)

export const Plugin = {
  id: "bolt.tool.semantic-search",
  effect: Effect.fn("SemanticSearchTool.Plugin")(function* (ctx: Context) {
    const environment = yield* Environment.Service
    const access = yield* FileAccess.Service
    const location = yield* Location.Service
    const permission = yield* Permission.Service
    const ripgrep = yield* Ripgrep.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name,
          options: { codemode: false },
          description:
            "Find code by meaning using local identifier splitting, definition weighting and lexical ranking. Describe the behavior you need; use grep for exact strings. Returns relevant source excerpts without calling an embedding provider.",
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              const source = { type: "tool" as const, messageID: context.messageID, id: context.id }
              const target = yield* access.resolve({ path: input.path ?? ".", kind: "directory" })
              yield* access.authorizeExternal([target], context)
              yield* permission.assert({
                action: name,
                resources: [input.query],
                save: ["*"],
                metadata: { query: input.query, path: target.absolute },
                sessionID: context.sessionID,
                agent: context.agent,
                source,
              })
              const type = yield* Environment.typeFollowing(environment.files, target.absolute)
              if (type !== "directory")
                return yield* Effect.fail(new ToolFailure({ message: `Directory not found: ${input.path ?? "."}` }))
              const entries = yield* ripgrep.find({ cwd: target.absolute, pattern: "*", limit: MAX_FILES }).pipe(
                Effect.timeoutOrElse({
                  duration: FileSystem.DEFAULT_SEARCH_TIMEOUT_MS,
                  orElse: () =>
                    Effect.fail(
                      new ToolFailure({ message: "Semantic search timed out. Use a more specific directory." }),
                    ),
                }),
              )
              const targets = entries.filter(
                (entry) => entry.type === "file" && extensions.has(path.extname(entry.path)),
              )
              const nested = yield* Effect.forEach(
                targets,
                (entry) =>
                  Effect.gen(function* () {
                    const file = path.resolve(target.absolute, entry.path)
                    // Each content read goes through the V2 leaf policy, including external-path and read rules.
                    const readable = yield* access.authorizeRead(file, context)
                    const result = yield* environment.files
                      .read(readable.absolute, { offset: 0, length: MAX_FILE_BYTES + 1 })
                      .pipe(
                        Effect.catchTag("Environment.NotFound", () => Effect.undefined),
                        Effect.catchTag("Environment.WrongKind", () => Effect.undefined),
                      )
                    if (!result || result.info.size > MAX_FILE_BYTES) return []
                    const text = new TextDecoder().decode(result.bytes)
                    if (!text) return []
                    return SemanticRank.chunk(path.relative(location.project.directory, file) || file, text)
                  }),
                { concurrency: 16 },
              )
              const chunks = nested.flat()
              const terms = SemanticRank.tokenize(input.query)
              const hits = SemanticRank.rank(input.query, chunks, input.limit ?? 8)
              const output = hits.map((hit) => ({
                file: hit.chunk.file,
                start: hit.chunk.start,
                end: hit.chunk.end,
                score: hit.score,
                snippet: SemanticRank.snippet(hit.chunk, terms),
              }))
              const content =
                output.length === 0
                  ? "No matching code found. Try different wording, or grep for exact strings."
                  : [
                      `Top ${output.length} result${output.length === 1 ? "" : "s"}:`,
                      ...output.map(
                        (hit) => `${hit.file}:${hit.start}-${hit.end} (score ${hit.score.toFixed(2)})\n${hit.snippet}`,
                      ),
                    ].join("\n\n")
              return {
                output,
                content,
                metadata: { title: input.query, files: targets.length, chunks: chunks.length, results: hits.length },
              }
            }).pipe(
              Effect.mapError((error) =>
                error instanceof ToolFailure
                  ? error
                  : new ToolFailure({ message: `Unable to search code: ${input.query}`, error }),
              ),
            ),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
