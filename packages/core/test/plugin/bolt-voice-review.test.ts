import { expect } from "bun:test"
import { Effect } from "effect"
import { BoltVoice } from "@opencode/schema/bolt-voice"
import { Plugin } from "@opencode/core/plugin"
import { Rpc } from "@opencode/core/rpc"
import { VoicePlugin } from "@opencode/core/plugin/voice"
import { VoiceTranscription } from "@opencode/core/voice/transcription"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "./fixture"

const it = testEffect(PluginTestLayer)
it.live("rejects malformed encoded audio before transcription", () =>
  Effect.gen(function* () {
    const plugins = yield* Plugin.Service
    const rpc = yield* Rpc.Service
    const services = yield* Effect.context<Effect.Services<ReturnType<typeof VoiceTranscription.transcribe>>>()
    yield* plugins.activate([
      {
        id: VoicePlugin.Plugin.id,
        revision: "1",
        effect: (ctx) => VoicePlugin.Plugin.effect(ctx).pipe(Effect.provide(services)),
      },
    ])
    yield* plugins.awaitActivation
    const client = rpc.client(BoltVoice.Definition)
    for (const audio of ["YQ?=", "Y Q==", "", "data:audio/wav;base64,YQ=="]) {
      const error = yield* client.transcribe({ audio, mime: "audio/wav" }).pipe(Effect.flip)
      expect(error.message).toContain("valid base64")
    }
  }),
)
