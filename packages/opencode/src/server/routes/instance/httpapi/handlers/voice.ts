import { VoiceTranscription } from "@/voice/transcription"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { InvalidRequestError, UpstreamError } from "../errors"
import { TranscribeInput } from "../groups/voice"

// OpenAI's transcription API rejects files over 25 MB; bound the base64
// payload before decoding so oversized audio fails fast instead of buffering
// and reaching the paid upstream call.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const MAX_AUDIO_BASE64_LENGTH = Math.ceil(MAX_AUDIO_BYTES / 3) * 4

const transcribe = Effect.fn("VoiceHttpApi.transcribe")(function* (ctx: {
  payload: typeof TranscribeInput.Type
}) {
  if (ctx.payload.audio.length > MAX_AUDIO_BASE64_LENGTH)
    return yield* new InvalidRequestError({ message: "audio exceeds the 25 MB limit", field: "audio" })
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

export const voiceHandlers = HttpApiBuilder.group(InstanceHttpApi, "voice", (handlers) =>
  Effect.sync(() => handlers.handle("transcribe", transcribe)),
)

function decodeAudio(input: string) {
  if (input.length === 0) return undefined
  // Buffer.from decodes leniently (invalid characters are silently dropped),
  // so reject malformed base64 up front instead of sending corrupted audio.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input)) return undefined
  const decoded = Buffer.from(input, "base64")
  if (decoded.length === 0) return undefined
  return new Uint8Array(decoded)
}
