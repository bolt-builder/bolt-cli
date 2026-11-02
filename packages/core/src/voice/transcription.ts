import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { AppProcess } from "@opencode/util/process"
import { Integration } from "../integration.js"
import { which } from "../util/which.js"
import { rm } from "node:fs/promises"
import path from "node:path"
import { Effect, Schema } from "effect"
import { HttpBody, HttpClient, HttpClientRequest } from "effect/http"
import { ChildProcess } from "effect/process"

export class NoCredentialError extends Schema.TaggedError<NoCredentialError>()("VoiceNoCredentialError", {
  message: Schema.String,
}) {}

export class TranscribeError extends Schema.TaggedError<TranscribeError>()("VoiceTranscribeError", {
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

// Default location for the local whisper.cpp model installed by
// `install --voice` (large-v3-turbo q5, ~0.6 GB). Override with
// BOLT_VOICE_MODEL.

// Single speech-to-text entrypoint. Prefers a local whisper.cpp install
// (free, offline, no credential) and falls back to the OpenAI API.
// Alternative transcription providers can be added by branching here instead
// of touching the HTTP surface or the TUI.
export const transcribe = Effect.fn("VoiceTranscription.transcribe")(function* (input: {
  audio: Uint8Array
  localOnly?: boolean
  mime: string
  language?: string
}) {
  const found = yield* local(input.mime)
  if (found) return yield* transcribeLocal(found, input)
  if (input.localOnly)
    return yield* new NoCredentialError({
      message: "Local voice input requires whisper-cli and a model. Set BOLT_VOICE_WHISPER and BOLT_VOICE_MODEL.",
    })
  const key = yield* resolveOpenaiKey()
  if (!key)
    return yield* new NoCredentialError({
      message:
        "Voice input needs a local whisper model or an OpenAI credential. Install whisper-cli and set BOLT_VOICE_MODEL for offline transcription, or run `bolt auth login` and add an OpenAI API key.",
    })
  const form = new FormData()
  form.append("model", "whisper-1")
  if (input.language) form.append("language", input.language)
  form.append(
    "file",
    new File([Uint8Array.from(input.audio)], `voice.${EXTENSIONS[input.mime] ?? "wav"}`, { type: input.mime }),
  )
  const client = yield* HttpClient.HttpClient
  const response = yield* client
    .execute(
      HttpClientRequest.post(
        `${(process.env.BOLT_VOICE_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")}/audio/transcriptions`,
        {
          headers: { authorization: `Bearer ${key}` },
          body: HttpBody.formData(form),
        },
      ),
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
    return yield* new TranscribeError({
      message: `Transcription failed: HTTP ${response.status}`,
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

// whisper-cli only decodes WAV without ffmpeg support compiled in, so the
// local path is limited to the recorder's native format; anything else falls
// through to the OpenAI API. Exported so CLI callers that require fully
// local transcription (e.g. `bolt run --voice`) can preflight availability.
export const local = Effect.fnUntraced(function* (mime: string) {
  if (!mime.includes("wav")) return undefined
  const global = yield* Global.Service
  const binary = process.env.BOLT_VOICE_WHISPER ?? which("whisper-cli") ?? which("whisper-cpp") ?? undefined
  if (!binary) return undefined
  const data = path.basename(global.data) === "opencode" ? path.join(path.dirname(global.data), "bolt") : global.data
  const model = process.env.BOLT_VOICE_MODEL ?? path.join(data, "models", "ggml-large-v3-turbo-q5_0.bin")
  const fsys = yield* FSUtil.Service
  if (!(yield* fsys.isFile(model))) return undefined
  return { binary, model }
})

// Exported alongside `local` so fully-local callers (`bolt run --voice`)
// can transcribe without pulling the OpenAI fallback's HTTP requirements.
export const transcribeLocal = Effect.fn("VoiceTranscription.local")(function* (
  found: { binary: string; model: string },
  input: { audio: Uint8Array; mime: string; language?: string },
) {
  const fsys = yield* FSUtil.Service
  const global = yield* Global.Service
  const file = path.join(global.tmp, `voice-${crypto.randomUUID()}.wav`)
  yield* fsys
    .writeWithDirs(file, input.audio)
    .pipe(Effect.mapError(() => new TranscribeError({ message: "Failed to stage audio for local transcription" })))
  const proc = yield* AppProcess.Service
  const result = yield* proc
    .run(
      ChildProcess.make(
        found.binary,
        ["-m", found.model, "-f", file, "--no-timestamps", "--no-prints", "--language", input.language ?? "auto"],
        { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
      ),
    )
    .pipe(
      Effect.mapError((error) => new TranscribeError({ message: `Local transcription failed: ${error}` })),
      Effect.timeoutOrElse({
        duration: "120 seconds",
        orElse: () => Effect.fail(new TranscribeError({ message: "Local transcription timed out after 120 seconds" })),
      }),
      Effect.ensuring(Effect.promise(() => rm(file, { force: true })).pipe(Effect.ignore)),
    )
  if (result.exitCode !== 0)
    return yield* new TranscribeError({
      message: `Local transcription failed: ${result.stderr.toString("utf8").trim() || `exit ${result.exitCode}`}`,
    })
  return { text: result.stdout.toString("utf8").trim() }
})

const resolveOpenaiKey = Effect.fnUntraced(function* () {
  const integrations = yield* Integration.Service
  const info = yield* integrations.get(Integration.ID.make("openai"))
  const connection = info?.connections.find((item) => item.type === "env" || item.method === "key")
  if (!connection) return undefined
  const credential = yield* integrations.connection.resolve(connection).pipe(Effect.orElseSucceed(() => undefined))
  return credential?.type === "key" ? credential.key : undefined
})

export * as VoiceTranscription from "./transcription.js"
