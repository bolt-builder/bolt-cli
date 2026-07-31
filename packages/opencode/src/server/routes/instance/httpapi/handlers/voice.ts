import { VoiceTranscription } from "@/voice/transcription"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { InvalidRequestError, UpstreamError } from "../errors"
import { TranscribeInput } from "../groups/voice"

export const voiceHandlers = HttpApiBuilder.group(InstanceHttpApi, "voice", (handlers) =>
  Effect.gen(function* () {
    const transcribe = Effect.fn("VoiceHttpApi.transcribe")(function* (ctx: {
      payload: typeof TranscribeInput.Type
    }) {
      const audio = decodeAudio(ctx.payload.audio)
      if (!audio) return yield* new InvalidRequestError({ message: "audio must be base64-encoded", field: "audio" })
      return yield* VoiceTranscription.transcribe({
        audio,
        mime: ctx.payload.mime ?? "audio/wav",
        language: ctx.payload.language,
      }).pipe(
        Effect.mapError((error) => {
          if (error instanceof VoiceTranscription.NoCredentialError)
            return new InvalidRequestError({ message: error.message })
          return new UpstreamError({ message: error.message, service: "openai", status: error.status })
        }),
      )
    })

    return handlers.handle("transcribe", transcribe)
  }),
)

function decodeAudio(input: string) {
  if (input.length === 0) return undefined
  const decoded = Buffer.from(input, "base64")
  if (decoded.length === 0) return undefined
  return new Uint8Array(decoded)
}
