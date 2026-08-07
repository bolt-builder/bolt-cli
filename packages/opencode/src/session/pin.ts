import { SessionV1 } from "@opencode-ai/core/v1/session"

// Collect every file path the conversation touched: attached file parts plus
// filePath arguments of completed tool calls (read/edit/write and friends).
function referenced(messages: SessionV1.WithParts[]) {
  return messages.flatMap((message) =>
    message.parts.flatMap((part) => {
      if (part.type === "file") {
        const url = part.url.split("?")[0]
        const file = url.startsWith("file://") ? decodeURIComponent(url.slice("file://".length)) : part.filename
        return file ? [file] : []
      }
      if (part.type === "tool" && part.state.status === "completed") {
        const file = (part.state.input as Record<string, unknown> | undefined)?.filePath
        return typeof file === "string" ? [file] : []
      }
      return []
    }),
  )
}

function matches(pin: string, file: string) {
  if (pin === file) return true
  return file.endsWith(`/${pin}`)
}

// Resolve configured pins against the conversation. Pins naming a file the
// conversation touched become file pins anchored to the resolved path; every
// other entry is carried as a verbatim fact. The returned block is appended to
// the compaction prompt so pinned context survives every summary.
export function resolve(input: { pins: string[]; messages: SessionV1.WithParts[] }) {
  if (!input.pins.length) return []
  const files = referenced(input.messages)
  const lines = input.pins.map((pin) => {
    const file = files.find((item) => matches(pin, item))
    if (file) return `- ${file}: pinned file, keep it listed in Relevant Files with its key details`
    return `- ${pin}`
  })
  return [["Pinned context (must be preserved in the summary, never drop or rewrite these):", ...lines].join("\n")]
}

export * as SessionPin from "./pin"
