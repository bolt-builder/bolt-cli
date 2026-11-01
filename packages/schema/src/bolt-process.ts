export * as BoltProcess from "./bolt-process.js"

import { Schema } from "effect"
import { Rpc } from "./rpc.js"

export const Info = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  title: Schema.optionalKey(Schema.String),
  status: Schema.Literals(["running", "completed", "error", "cancelled"]),
  started_at: Schema.Number,
  completed_at: Schema.optionalKey(Schema.Number),
  output: Schema.optionalKey(Schema.String),
  error: Schema.optionalKey(Schema.String),
})
export type Info = typeof Info.Type

export const Definition = Rpc.define({
  id: "bolt.process",
  events: {},
  methods: {
    list: {
      input: Schema.toStandardSchemaV1(Schema.Struct({})),
      output: Schema.toStandardSchemaV1(Schema.Array(Info)),
    },
    cancel: {
      input: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
      output: Schema.toStandardSchemaV1(Schema.NullOr(Info)),
    },
  },
})
