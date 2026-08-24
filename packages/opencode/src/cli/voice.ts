import { Effect } from "effect"
import { UI } from "./ui"
import { fail } from "./effect-cmd"

// Voice input for one-shot runs (`bolt run --voice`): reuse the TUI
// push-to-talk recorder, require a local whisper.cpp install (no network
// fallback), and return the transcript to append to the prompt.

export const HINT =
  "Voice input requires a local whisper.cpp install. Install whisper-cli (e.g. `brew install whisper-cpp`, or https://github.com/ggml-org/whisper.cpp) and a ggml model, then set OPENCODE_VOICE_WHISPER and OPENCODE_VOICE_MODEL if they are not on the default paths."

/** Map a raw stdin byte to a recording action. Enter stops, Ctrl+C aborts. */
export function keypress(byte: number | undefined): "stop" | "abort" | undefined {
  if (byte === 0x0d || byte === 0x0a) return "stop"
  if (byte === 0x03) return "abort"
  return undefined
}

function key() {
  return new Promise<"stop" | "abort">((resolve) => {
    const stdin = process.stdin
    if (stdin.isTTY) stdin.setRawMode(true)
    stdin.resume()
    const consume = (chunk: Buffer) => {
      const action = keypress(chunk[0])
      if (!action) return
      stdin.off("data", consume)
      if (stdin.isTTY) stdin.setRawMode(false)
      stdin.pause()
      resolve(action)
    }
    stdin.on("data", consume)
  })
}

/** Record until Enter (or the recorder's duration cap) and transcribe locally. */
export const capture = Effect.fn("CliVoice.capture")(function* () {
  const { voice } = yield* Effect.promise(() => import("@opencode-ai/tui/voice"))
  const { VoiceTranscription } = yield* Effect.promise(() => import("@/voice/transcription"))
  const { AppNodeBuilder } = yield* Effect.promise(() => import("@opencode-ai/core/effect/app-node-builder"))
  const { LayerNode } = yield* Effect.promise(() => import("@opencode-ai/core/effect/layer-node"))
  const { Env } = yield* Effect.promise(() => import("@/env"))
  const { AppProcess } = yield* Effect.promise(() => import("@opencode-ai/core/process"))
  // Env and AppProcess are not part of AppServices; build them locally for
  // the whisper preflight and the whisper-cli invocation.
  const services = AppNodeBuilder.build(LayerNode.group([Env.node, AppProcess.node]))
  const found = yield* VoiceTranscription.local("audio/wav").pipe(Effect.provide(services))
  if (!found) return yield* fail(HINT)
  const started = voice.start()
  if (started) return yield* fail(started)
  UI.println(UI.Style.TEXT_INFO_BOLD + "●", UI.Style.TEXT_NORMAL + "Recording... press Enter to stop")
  const action = yield* Effect.promise(() => key())
  const take = yield* Effect.promise(() => voice.stop())
  voice.reset()
  if (action === "abort") {
    UI.println("Voice input aborted")
    process.exit(130)
  }
  if (take.error) return yield* fail(take.error)
  if (!take.audio) return yield* fail("No audio captured")
  UI.println(UI.Style.TEXT_DIM + "Transcribing locally..." + UI.Style.TEXT_NORMAL)
  const result = yield* VoiceTranscription.transcribeLocal(found, {
    audio: Buffer.from(take.audio, "base64"),
    mime: "audio/wav",
  }).pipe(
    Effect.provide(services),
    Effect.catch((error) => fail(error.message)),
  )
  const text = result.text.trim()
  if (!text) return yield* fail("Transcription produced no text")
  UI.println(UI.Style.TEXT_DIM + `» ${text}` + UI.Style.TEXT_NORMAL)
  return text
})

export * as CliVoice from "./voice"
