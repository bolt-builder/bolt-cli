export * as BoltSandbox from "./bolt-sandbox.js"

import { Schema } from "effect"
import { Rpc } from "./rpc.js"
import { Session } from "./session.js"

export const Definition = Rpc.define({
  id: "bolt.sandbox",
  events: {},
  methods: {
    set: {
      input: Schema.toStandardSchemaV1(Schema.Struct({ sessionID: Session.ID, enabled: Schema.Boolean })),
      output: Schema.toStandardSchemaV1(Schema.Struct({ enabled: Schema.Boolean })),
      errors: { unavailable: Schema.toStandardSchemaV1(Schema.Struct({})) },
    },
  },
})
