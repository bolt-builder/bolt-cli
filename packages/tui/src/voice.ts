import { spawn, type ChildProcess } from "node:child_process"
import { rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createSignal } from "solid-js"

export type VoiceStatus = "idle" | "recording" | "transcribing"

type Active = { child: ChildProcess; file: string; exit: Promise<void> }

const [status, setStatus] = createSignal<VoiceStatus>("idle")

let active: Active | undefined

function locate() {
  if (Bun.which("rec")) return "rec"
  if (Bun.which("sox")) return "sox"
  if (process.platform === "linux" && Bun.which("arecord")) return "arecord"
  // ffmpeg capture needs a per-device name on Windows (dshow), so only use it
  // as a fallback where the default device is addressable.
  if (process.platform !== "win32" && Bun.which("ffmpeg")) return "ffmpeg"
  return undefined
}

// Cap recording length so an unattended session cannot grow unbounded: 5
// minutes of 16 kHz mono 16-bit WAV is ~9.6 MB, well within the server's
// 25 MB transcription payload limit.
const MAX_SECONDS = 300

function args(command: string, file: string) {
  if (command === "rec") return ["-q", "-c", "1", "-r", "16000", file, "trim", "0", String(MAX_SECONDS)]
  if (command === "sox") return ["-q", "-d", "-c", "1", "-r", "16000", file, "trim", "0", String(MAX_SECONDS)]
  if (command === "arecord")
    return ["-q", "-f", "S16_LE", "-r", "16000", "-c", "1", "-d", String(MAX_SECONDS), file]
  const input = process.platform === "darwin" ? ["-f", "avfoundation", "-i", ":0"] : ["-f", "alsa", "-i", "default"]
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    ...input,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-t",
    String(MAX_SECONDS),
    "-y",
    file,
  ]
}

// Starts push-to-talk recording via the first available recorder binary.
// Returns an error message when recording cannot start.
function start() {
  if (status() !== "idle") return undefined
  const command = locate()
  if (!command) return "No audio recorder found. Install sox (`rec`), `arecord`, or `ffmpeg` to use voice input."
  const file = path.join(os.tmpdir(), `opencode-voice-${Date.now()}.wav`)
  const child = spawn(command, args(command, file), { stdio: ["ignore", "ignore", "ignore"] })
  const exit = new Promise<void>((resolve) => {
    child.once("error", () => {
      // Recorder died before/without exiting (e.g. binary vanished); recover to idle.
      if (active?.child === child) {
        active = undefined
        setStatus("idle")
      }
      resolve()
    })
    child.once("exit", (code) => {
      // Exit code 0 means the recorder finished on its own (duration cap
      // reached) and finalized the WAV; keep the take so /voice stop can
      // still transcribe it. Any other exit is a crash; recover to idle.
      if (code !== 0 && active?.child === child) {
        active = undefined
        setStatus("idle")
      }
      resolve()
    })
  })
  active = { child, file, exit }
  setStatus("recording")
  return undefined
}

// Stops the recorder and returns the captured audio as base64 WAV, or an
// error describing why there is nothing to transcribe. Leaves status at
// "transcribing" on success so the caller can run transcription and must
// call reset() after.
async function stop(): Promise<{ audio?: string; error?: string }> {
  const current = active
  if (!current) return { error: "No audio captured" }
  active = undefined
  setStatus("transcribing")
  // SIGINT lets sox/arecord/ffmpeg finalize the WAV header before exiting.
  current.child.kill("SIGINT")
  const timer = setTimeout(() => current.child.kill("SIGKILL"), 3000)
  await current.exit
  clearTimeout(timer)
  const bytes = await Bun.file(current.file)
    .arrayBuffer()
    .catch(() => undefined)
  await rm(current.file, { force: true }).catch(() => undefined)
  if (!bytes || bytes.byteLength === 0) {
    setStatus("idle")
    return { error: "No audio captured" }
  }
  // Gate obviously useless takes before the paid transcription call:
  // accidental taps and silent recordings both transcribe to nothing.
  const measured = measure(bytes)
  if (measured && measured.duration < 0.4) {
    setStatus("idle")
    return { error: "Recording too short, ignored" }
  }
  if (measured && measured.peak < 0.01) {
    setStatus("idle")
    return { error: "No speech detected" }
  }
  return { audio: Buffer.from(bytes).toString("base64") }
}

// Reads duration and peak amplitude from a 16-bit PCM WAV. Returns undefined
// on anything unexpected so analysis failures never block transcription.
export function measure(bytes: ArrayBuffer) {
  const view = new DataView(bytes)
  if (bytes.byteLength < 44) return undefined
  if (view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57415645) return undefined
  const chunk = (id: number) => {
    for (let offset = 12; offset + 8 <= bytes.byteLength; ) {
      const size = view.getUint32(offset + 4, true)
      if (view.getUint32(offset, false) === id) return { offset: offset + 8, size }
      offset += 8 + size + (size % 2)
    }
    return undefined
  }
  const fmt = chunk(0x666d7420)
  const data = chunk(0x64617461)
  if (!fmt || !data || fmt.size < 16) return undefined
  const channels = view.getUint16(fmt.offset + 2, true)
  const rate = view.getUint32(fmt.offset + 4, true)
  const bits = view.getUint16(fmt.offset + 14, true)
  if (bits !== 16 || channels === 0 || rate === 0) return undefined
  if (data.offset % 2 !== 0) return undefined
  const size = Math.min(data.size, bytes.byteLength - data.offset)
  const count = Math.floor(size / 2)
  const duration = count / channels / rate
  const samples = new Int16Array(bytes, data.offset, count)
  const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0)
  return { duration, peak: peak / 32768 }
}

function reset() {
  setStatus("idle")
}

export const voice = { status, start, stop, reset }
