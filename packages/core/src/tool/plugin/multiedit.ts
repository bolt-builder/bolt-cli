export * as MultiEditTool from "./multiedit.js"

import { ToolFailure } from "@opencode/ai/effect"
import type { Context } from "@opencode/plugin/effect/plugin"
import { FileDiff } from "@opencode/schema/file-diff"
import { Bom } from "@opencode/util/bom"
import { Effect, Schema } from "effect"
import { Environment } from "../../environment/index.js"
import { FileAccess } from "../../file-access.js"
import { FileMutation } from "../../file-mutation.js"
import { Formatter } from "../../formatter.js"
import { KV } from "../../kv.js"
import { Location } from "../../location.js"
import { Permission } from "../../permission.js"
import { Session } from "../../session.js"
import { ReadProof } from "../read-proof.js"
import { EditTool } from "./edit.js"
import { fileDiff } from "./file-diff.js"
import DESCRIPTION from "./multiedit.txt"

const Edit = Schema.Struct({
  oldString: Schema.String,
  newString: Schema.String,
  replaceAll: Schema.optionalKey(Schema.Boolean),
})
export const Input = Schema.Struct({ filePath: Schema.String, edits: Schema.Array(Edit).check(Schema.isMinLength(1)) })
const Output = Schema.Struct({ files: Schema.Array(FileDiff.Info), edits: Schema.Number, replacements: Schema.Number })

export const apply = (source: string, edits: readonly (typeof Edit.Type)[]) =>
  edits.reduce(
    (state, edit, index) => {
      if (!edit.oldString || edit.oldString === edit.newString)
        throw new Error(
          `Edit ${index + 1} of ${edits.length} failed, no changes applied: oldString must be nonempty and differ from newString`,
        )
      const matched = EditTool.matchText(state.content, edit.oldString, edit.newString)
      if (!matched.matches.length || (matched.matches.length > 1 && !edit.replaceAll))
        throw new Error(
          `Edit ${index + 1} of ${edits.length} failed, no changes applied: ${matched.matches.length} matches; expected ${edit.replaceAll ? "at least one" : "exactly one"}`,
        )
      const selected = edit.replaceAll ? matched.matches : matched.matches.slice(0, 1)
      return {
        content: selected
          .toReversed()
          .reduce(
            (text, match) => text.slice(0, match.start) + matched.replace(match) + text.slice(match.end),
            state.content,
          ),
        replacements: state.replacements + selected.length,
      }
    },
    { content: source, replacements: 0 },
  )

export const Plugin = {
  id: "bolt.tool.multiedit",
  effect: Effect.fn("MultiEditTool.Plugin")(function* (ctx: Context) {
    const environment = yield* Environment.Service
    const access = yield* FileAccess.Service
    const mutations = yield* FileMutation.Service
    const formatter = yield* Formatter.Service
    const location = yield* Location.Service
    const permission = yield* Permission.Service
    const kv = yield* KV.Service
    const sessions = yield* Session.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name: "multiedit",
          options: { codemode: false, permission: "edit" },
          description: DESCRIPTION,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              const target = yield* access.resolve({ path: input.filePath, kind: "file" })
              yield* access.authorizeExternal([target], context)
              if (!(yield* ReadProof.has(kv, sessions, context.sessionID, location.directory, target.absolute)))
                return yield* Effect.fail(
                  new ToolFailure({ message: "Read this file with the read tool before using multiedit." }),
                )
              const original = yield* FileMutation.readText(environment.files, target.absolute).pipe(
                Effect.catchTag("Environment.NotFound", () =>
                  Effect.fail(new ToolFailure({ message: `File ${input.filePath} not found` })),
                ),
              )
              const next = yield* Effect.try({
                try: () => apply(original.text, input.edits),
                catch: (error) => new ToolFailure({ message: error instanceof Error ? error.message : String(error) }),
              })
              const preview = fileDiff(target.resource, original.text, next.content)
              yield* permission.assert({
                action: "edit",
                resources: [target.resource],
                save: ["*"],
                metadata: { files: [preview] },
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.messageID, id: context.id },
              })
              if (next.content !== original.text)
                yield* mutations.write({
                  target,
                  content: Bom.join(next.content, original.bom || next.content.startsWith("\uFEFF")),
                })
              const formatted =
                next.content !== original.text && (yield* formatter.file(target.absolute))
                  ? yield* FileMutation.syncTextBom(
                      environment.files,
                      target.absolute,
                      original.bom || next.content.startsWith("\uFEFF"),
                    )
                  : next.content
              const files = [fileDiff(target.resource, original.text, formatted)]
              return {
                output: { files, edits: input.edits.length, replacements: next.replacements },
                content: [
                  {
                    type: "text" as const,
                    text: `Applied ${input.edits.length} edit${input.edits.length === 1 ? "" : "s"} successfully.`,
                  },
                ],
                metadata: { files },
              }
            }).pipe(
              mutations.withLock([FileAccess.resolvePath(location.directory, input.filePath)]),
              Effect.mapError(
                (error) => new ToolFailure({ message: `Unable to apply edits to ${input.filePath}`, error }),
              ),
            ),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
