import { Option, Schema } from "effect"

declare const BOLT_VERSION: string
declare const BOLT_CHANNEL: string
declare const BOLT_ARTIFACT: string
declare const BOLT_RELEASE_HIGHLIGHTS: string

const version = typeof BOLT_VERSION === "string" ? BOLT_VERSION : "local"
const channel = typeof BOLT_CHANNEL === "string" ? BOLT_CHANNEL : "local"
const artifact = typeof BOLT_ARTIFACT === "string" ? BOLT_ARTIFACT : "cli"
// Stable release builds embed the release notes' Highlights; every other build has none.
const highlights =
  typeof BOLT_RELEASE_HIGHLIGHTS === "string"
    ? Option.getOrElse(
        Schema.decodeUnknownOption(
          Schema.fromJsonString(Schema.Array(Schema.Struct({ title: Schema.String, body: Schema.String }))),
        )(BOLT_RELEASE_HIGHLIGHTS),
        () => [],
      )
    : []

export {
  version as BOLT_VERSION,
  channel as BOLT_CHANNEL,
  artifact as BOLT_ARTIFACT,
  highlights as BOLT_HIGHLIGHTS,
}
export const BOLT_LOCAL = channel === "local"
