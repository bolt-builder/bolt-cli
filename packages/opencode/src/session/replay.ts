import path from "path"
import fs from "fs/promises"
import type { ModelMessage } from "ai"
import { Global } from "@opencode-ai/core/global"

export const DIR = "replay"

export interface Input {
  sessionID: string
  messageID: string
  time: number
  providerID: string
  modelID: string
  system: string[]
  messages: ModelMessage[]
  tools: string[]
}

// The recorded shape is the request as prepared for the provider: final
// system prompt sections, converted model messages, and the tool names that
// were offered. Tool names are sorted so records diff cleanly across turns.
export function serialize(input: Input) {
  return {
    version: 1,
    time: input.time,
    sessionID: input.sessionID,
    messageID: input.messageID,
    model: { providerID: input.providerID, modelID: input.modelID },
    system: input.system,
    tools: [...input.tools].sort(),
    messages: input.messages,
  }
}

export function directory(sessionID: string, base = Global.Path.data) {
  return path.join(base, DIR, sessionID)
}

// Timestamp-first filenames keep the listing chronological with a plain sort.
export async function record(input: Input, base = Global.Path.data) {
  const target = path.join(directory(input.sessionID, base), `${input.time}-${input.messageID}.json`)
  await Bun.write(target, JSON.stringify(serialize(input), null, 2))
  return target
}

export async function list(sessionID: string, base = Global.Path.data) {
  const entries = await fs.readdir(directory(sessionID, base)).catch(() => [] as string[])
  return entries.filter((entry) => entry.endsWith(".json")).sort()
}

export function load(sessionID: string, name: string, base = Global.Path.data) {
  return Bun.file(path.join(directory(sessionID, base), name)).json()
}

export * as SessionReplay from "./replay"
