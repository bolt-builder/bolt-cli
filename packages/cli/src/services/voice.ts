import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { BoltVoice } from "@opencode/schema/bolt-voice"
import type { ServerConnection } from "./server-connection"

export function keypress(byte: number | undefined): "stop" | "abort" | undefined {
  if (byte === 0x0d || byte === 0x0a) return "stop"
  if (byte === 0x03) return "abort"
}

/** One-shot voice stays fully local, including transcription. */
export async function capture(server: ServerConnection.Resolved) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(server.endpoint.url).hostname))
    throw new Error("--voice requires a local Bolt server for offline transcription.")
  if (!process.stdin.isTTY) throw new Error("--voice requires an interactive terminal.")
  const client = OpenCode.make({ baseUrl: server.endpoint.url, headers: Service.headers(server.endpoint) })
  const rpc = client.rpc(BoltVoice.Definition)
  if (!(await rpc.local({})).available)
    throw new Error("Install whisper-cli and a ggml model, then set BOLT_VOICE_WHISPER and BOLT_VOICE_MODEL.")
  const { voice } = await import("@opencode/tui/voice")
  const error = voice.start()
  if (error) throw new Error(error)
  process.stderr.write("Recording… press Enter to stop, Ctrl+C to abort.\n")
  try {
    const action = await new Promise<"stop" | "abort">((resolve) => {
      const raw = process.stdin.isRaw
      process.stdin.setRawMode(true)
      process.stdin.resume()
      const consume = (chunk: Buffer) => {
        const action = keypress(chunk[0])
        if (!action) return
        process.stdin.off("data", consume)
        process.stdin.setRawMode(raw)
        process.stdin.pause()
        resolve(action)
      }
      process.stdin.on("data", consume)
    })
    const take = await voice.stop()
    if (action === "abort") {
      process.exitCode = 130
      throw new Error("Voice input aborted")
    }
    if (!take.audio) throw new Error(take.error ?? "No audio captured")
    process.stderr.write("Transcribing locally…\n")
    const result = await rpc.transcribe({ audio: take.audio, mime: "audio/wav", localOnly: true })
    if (!result.text.trim()) throw new Error("Transcription produced no text")
    return result.text.trim()
  } finally {
    await voice.reset()
  }
}
