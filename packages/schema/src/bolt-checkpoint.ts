export * as BoltCheckpoint from "./bolt-checkpoint.js"

import { Schema } from "effect"
import { Rpc } from "./rpc.js"

export const Name = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/))
export const Info = Schema.Struct({
  name: Name,
  time: Schema.Finite,
  snapshot: Schema.String,
  sessionID: Schema.optionalKey(Schema.String),
  messageID: Schema.optionalKey(Schema.String),
})
export type Info = typeof Info.Type
const errors = { failed: Schema.toStandardSchemaV1(Schema.Struct({})) }

export const Definition = Rpc.define({
  id: "bolt.checkpoint",
  events: {},
  methods: {
    save: {
      input: Schema.toStandardSchemaV1(Schema.Struct({ name: Name, sessionID: Schema.optionalKey(Schema.String) })),
      output: Schema.toStandardSchemaV1(Info),
      errors,
    },
    list: {
      input: Schema.toStandardSchemaV1(Schema.Struct({})),
      output: Schema.toStandardSchemaV1(Schema.Array(Info)),
      errors,
    },
    rewind: {
      input: Schema.toStandardSchemaV1(Schema.Struct({ name: Name })),
      output: Schema.toStandardSchemaV1(Info),
      errors,
    },
    remove: {
      input: Schema.toStandardSchemaV1(Schema.Struct({ name: Name })),
      output: Schema.toStandardSchemaV1(Schema.Struct({ removed: Name })),
      errors,
    },
  },
})
