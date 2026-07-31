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

function args(command: string, file: string) {
  if (command === "rec") return ["-q", "-c", "1", "-r", "16000", file]
  if (command === "sox") return ["-q", "-d", "-c", "1", "-r", "16000", file]
  if (command === "arecord") return ["-q", "-f", "S16_LE", "-r", "16000", "-c", "1", file]
  const input = process.platform === "darwin" ? ["-f", "avfoundation", "-i", ":0"] : ["-f", "alsa", "-i", "default"]
  return ["-hide_banner", "-loglevel", "error", ...input, "-ac", "1", "-ar", "16000", "-y", file]
}

// Starts push-to-talk recording via the first available recorder binary.
// Returns an error message when recording cannot start.
function start() {
  if (status() !== "idle") return
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
    child.once("exit", () => {
      if (active?.child === child) {
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

// Stops the recorder and returns the captured audio as base64 WAV, or
// undefined when nothing was captured. Leaves status at "transcribing" on
// success so the caller can run transcription and must call reset() after.
async function stop() {
  const current = active
  if (!current) return undefined
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
  await rm(current.file, { force: true }).catch(() => {})
  if (!bytes || bytes.byteLength === 0) {
    setStatus("idle")
    return undefined
  }
  return Buffer.from(bytes).toString("base64")
}

function reset() {
  setStatus("idle")
}

export const voice = { status, start, stop, reset }
