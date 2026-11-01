export * as BoltMemory from "./bolt-memory.js"

import { Schema } from "effect"
import { Rpc } from "./rpc.js"

export const Result = Schema.Struct({ text: Schema.String, root: Schema.String })
export const Management = Schema.Union([
  Schema.Struct({ action: Schema.Literal("export") }),
  Schema.Struct({ action: Schema.Literal("learn") }),
  Schema.Struct({ action: Schema.Literal("import"), text: Schema.String }),
  Schema.Struct({
    action: Schema.Literal("team"),
    operation: Schema.Literals(["init", "share"]),
    query: Schema.optionalKey(Schema.String),
  }),
  Schema.Struct({ action: Schema.Literal("diff"), apply: Schema.Boolean, discard: Schema.Boolean }),
  Schema.Struct({ action: Schema.Literal("review"), enabled: Schema.Boolean }),
  Schema.Struct({
    action: Schema.Literal("search"),
    query: Schema.String,
    limit: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  }),
  Schema.Struct({ action: Schema.Literal("conflicts"), fix: Schema.Boolean }),
  Schema.Struct({ action: Schema.Literal("dossier") }),
])
export const ManagementResult = Schema.Struct({
  root: Schema.String,
  text: Schema.String,
  count: Schema.optionalKey(Schema.Number),
})
export const Definition = Rpc.define({
  id: "bolt.memory",
  methods: {
    manage: {
      input: Schema.toStandardSchemaV1(Management),
      output: Schema.toStandardSchemaV1(ManagementResult),
      errors: { failed: Schema.toStandardSchemaV1(Schema.Struct({})) },
    },
    command: {
      input: Schema.toStandardSchemaV1(
        Schema.Struct({ text: Schema.String, sessionID: Schema.optionalKey(Schema.String) }),
      ),
      output: Schema.toStandardSchemaV1(Result),
      errors: { failed: Schema.toStandardSchemaV1(Schema.Struct({})) },
    },
  },
  events: {},
})
