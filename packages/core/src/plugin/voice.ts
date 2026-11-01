export * as VoicePlugin from "./voice.js"

import { define } from "@opencode/plugin/effect/plugin"
import { BoltVoice } from "@opencode/schema/bolt-voice"
import { Effect } from "effect"
import { VoiceTranscription } from "../voice/transcription.js"

export const Plugin = define({
  id: "bolt.voice",
  effect: Effect.fn(function* (ctx) {
    // Capture host services once: RPC executions do not inherit the plugin activation environment.
    const services = yield* Effect.context<Effect.Services<ReturnType<typeof VoiceTranscription.transcribe>>>()
    yield* ctx.rpc
      .register(BoltVoice.Definition, {
        local: () =>
          VoiceTranscription.local("audio/wav").pipe(
            Effect.provide(services),
            Effect.map((found) => ({ available: found !== undefined })),
          ),
        transcribe: (input, context) =>
          Effect.gen(function* () {
            if (
              input.audio.length > Math.ceil((25 * 1024 * 1024) / 3) * 4 ||
              !/^[A-Za-z0-9+/]+={0,2}$/.test(input.audio)
            )
              return yield* new VoiceTranscription.TranscribeError({
                message: "Audio must be valid base64 and at most 25 MB.",
              })
            const audio = Buffer.from(input.audio, "base64")
            if (!audio.length || audio.byteLength > 25 * 1024 * 1024)
              return yield* new VoiceTranscription.TranscribeError({
                message: "Audio must be non-empty and at most 25 MB.",
              })
            return yield* VoiceTranscription.transcribe({ ...input, audio }).pipe(Effect.provide(services))
          }).pipe(Effect.mapError((error) => context.error("failed", error.message, {}))),
      })
      .pipe(Effect.orDie)
  }),
})
