export * as BoltVoice from "./bolt-voice.js"

import { Schema } from "effect"
import { Rpc } from "./rpc.js"

export const Definition = Rpc.define({
  id: "bolt.voice",
  events: {},
  methods: {
    local: {
      input: Schema.toStandardSchemaV1(Schema.Struct({})),
      output: Schema.toStandardSchemaV1(Schema.Struct({ available: Schema.Boolean })),
    },
    transcribe: {
      input: Schema.toStandardSchemaV1(
        Schema.Struct({
          audio: Schema.String.check(Schema.isMaxLength(34_952_536)),
          mime: Schema.String,
          localOnly: Schema.optionalKey(Schema.Boolean),
          language: Schema.optionalKey(Schema.String),
        }),
      ),
      output: Schema.toStandardSchemaV1(Schema.Struct({ text: Schema.String })),
      errors: { failed: Schema.toStandardSchemaV1(Schema.Struct({})) },
    },
  },
})
