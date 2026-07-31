import { Auth } from "@/auth"
import { Env } from "@/env"
import { Effect, Schema } from "effect"
import { HttpBody, HttpClient, HttpClientRequest } from "effect/unstable/http"

export class NoCredentialError extends Schema.TaggedErrorClass<NoCredentialError>()("VoiceNoCredentialError", {
  message: Schema.String,
}) {}

export class TranscribeError extends Schema.TaggedErrorClass<TranscribeError>()("VoiceTranscribeError", {
  message: Schema.String,
  status: Schema.optional(Schema.Number),
}) {}

const Result = Schema.Struct({ text: Schema.String })

const EXTENSIONS: Record<string, string> = {
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
}

// Single speech-to-text entrypoint. Alternative transcription providers can be
// added by branching here on the resolved credential/provider instead of
// touching the HTTP surface or the TUI.
export const transcribe = Effect.fn("VoiceTranscription.transcribe")(function* (input: {
  audio: Uint8Array
  mime: string
  language?: string
}) {
  const key = yield* resolveOpenaiKey()
  if (!key)
    return yield* new NoCredentialError({
      message: "Voice input needs an OpenAI credential. Run `opencode auth login` and add an OpenAI API key.",
    })
  const form = new FormData()
  form.append("model", "whisper-1")
  if (input.language) form.append("language", input.language)
  form.append(
    "file",
    new File([input.audio as BlobPart], `voice.${EXTENSIONS[input.mime] ?? "wav"}`, { type: input.mime }),
  )
  const client = yield* HttpClient.HttpClient
  const response = yield* client
    .execute(
      HttpClientRequest.post("https://api.openai.com/v1/audio/transcriptions", {
        headers: { authorization: `Bearer ${key}` },
        body: HttpBody.formData(form),
      }),
    )
    .pipe(
      Effect.mapError((error) => new TranscribeError({ message: `Transcription request failed: ${error}` })),
      // Bound the upstream call so a hung upload cannot pin the TUI in
      // "transcribing" forever. 60s leaves room for a max-length (5 minute,
      // ~9.6 MB) recording to upload on slow links.
      Effect.timeoutOrElse({
        duration: "60 seconds",
        orElse: () => Effect.fail(new TranscribeError({ message: "Transcription timed out after 60 seconds" })),
      }),
    )
  if (response.status < 200 || response.status >= 300) {
    const body = yield* response.text.pipe(Effect.orElseSucceed(() => ""))
    return yield* new TranscribeError({
      message: `Transcription failed: ${response.status} ${body}`.trim(),
      status: response.status,
    })
  }
  const json = yield* response.json.pipe(
    Effect.mapError(() => new TranscribeError({ message: "Transcription returned an unreadable response" })),
  )
  const decoded = Schema.decodeUnknownOption(Result)(json)
  if (decoded._tag === "None")
    return yield* new TranscribeError({ message: "Transcription returned an unexpected response shape" })
  return decoded.value
})

const resolveOpenaiKey = Effect.fnUntraced(function* () {
  const env = yield* Env.Service
  const fromEnv = yield* env.get("OPENAI_API_KEY")
  if (fromEnv) return fromEnv
  const auth = yield* Auth.Service
  const info = yield* auth.get("openai").pipe(Effect.orElseSucceed(() => undefined))
  if (info?.type === "api") return info.key
  if (info?.type === "oauth") return info.access
  if (info?.type === "wellknown") return info.token
  return undefined
})

export * as VoiceTranscription from "./transcription"
