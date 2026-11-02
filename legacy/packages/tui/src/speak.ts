import { spawn, type ChildProcess } from "node:child_process"
import { createSignal } from "solid-js"

// Text-to-speech for agent answers. Mirrors voice.ts: pick the first
// available system speaker, keep a single active child so a new answer
// interrupts the previous one, and never throw (speech is decorative).

export type SpeakStatus = "idle" | "speaking"

// Long answers are unpleasant to listen to and some engines choke on huge
// argv/stdin payloads, so cap what we read aloud.
const MAX_CHARS = 1200

const [status, setStatus] = createSignal<SpeakStatus>("idle")

let active: ChildProcess | undefined

function locate(): { command: string; args: (text: string) => string[]; stdin?: boolean } | undefined {
  if (process.platform === "darwin" && Bun.which("say")) return { command: "say", args: () => [], stdin: true }
  if (process.platform === "win32") {
    return {
      command: "powershell",
      args: () => [
        "-NoProfile",
        "-Command",
        "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak([Console]::In.ReadToEnd())",
      ],
      stdin: true,
    }
  }
  if (Bun.which("piper") && Bun.which("aplay") && process.env["BOLT_PIPER_MODEL"]) {
    return {
      command: "sh",
      args: () => ["-c", 'piper --model "$BOLT_PIPER_MODEL" --output-raw | aplay -q -r 22050 -f S16_LE -t raw -'],
      stdin: true,
    }
  }
  if (Bun.which("espeak-ng")) return { command: "espeak-ng", args: () => ["--stdin"], stdin: true }
  if (Bun.which("espeak")) return { command: "espeak", args: () => ["--stdin"], stdin: true }
  if (Bun.which("spd-say")) return { command: "spd-say", args: (text) => ["-w", text] }
  return undefined
}

// Strips markdown and code so the speaker reads prose, not punctuation.
export function clean(input: string) {
  return input
    .replace(/```[\s\S]*?```/g, " code block omitted. ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/^[#>\-*+\s]+/gm, "")
    .replace(/\|/g, " ")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function stop() {
  const current = active
  active = undefined
  if (current && !current.killed) current.kill("SIGTERM")
  setStatus("idle")
}

// Speaks the text, interrupting anything already speaking. Returns an error
// message when no speech engine is available, otherwise undefined.
function say(text: string) {
  const speaker = locate()
  if (!speaker) {
    return "No speech engine found. Install espeak-ng, piper+aplay, or speech-dispatcher (macOS and Windows work out of the box)."
  }
  const body = clean(text).slice(0, MAX_CHARS)
  if (!body) return undefined
  stop()
  const child = spawn(speaker.command, speaker.args(body), {
    stdio: [speaker.stdin ? "pipe" : "ignore", "ignore", "ignore"],
  })
  const finish = () => {
    if (active === child) {
      active = undefined
      setStatus("idle")
    }
  }
  child.once("error", finish)
  child.once("exit", finish)
  if (speaker.stdin) {
    child.stdin?.on("error", () => undefined)
    child.stdin?.end(body)
  }
  active = child
  setStatus("speaking")
  return undefined
}

export const speak = {
  status,
  say,
  stop,
  available: () => locate() !== undefined,
}
