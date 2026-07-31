import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"
import { InvalidRequestError, UpstreamError } from "../errors"
import { described } from "./metadata"

export const TranscribeInput = Schema.Struct({
  audio: Schema.String.annotate({ description: "Base64-encoded audio data" }),
  mime: Schema.optional(Schema.String),
  language: Schema.optional(Schema.String),
}).annotate({ identifier: "VoiceTranscribeInput" })

export const TranscribeResult = Schema.Struct({
  text: Schema.String,
}).annotate({ identifier: "VoiceTranscribeResult" })

export const VoiceApi = HttpApi.make("voice").add(
  HttpApiGroup.make("voice")
    .add(
      HttpApiEndpoint.post("transcribe", "/voice/transcribe", {
        query: WorkspaceRoutingQuery,
        payload: TranscribeInput,
        success: described(TranscribeResult, "Transcribed text"),
        error: [InvalidRequestError, UpstreamError],
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "voice.transcribe",
          summary: "Transcribe audio",
          description: "Transcribe recorded audio to text using the configured speech-to-text provider.",
        }),
      ),
    )
    .annotateMerge(
      OpenApi.annotations({
        title: "voice",
        description: "Voice transcription routes.",
      }),
    )
    .middleware(InstanceContextMiddleware)
    .middleware(WorkspaceRoutingMiddleware)
    .middleware(Authorization),
)
