type Entry = {
  file: string
  section: string
  key: string
  text: string
  updatedAt?: number
  sessionID?: string
  messageID?: string
}

type Digest = {
  id: string
  time: string
  topic?: string
  summary: string
}

/** Render stored memory entries and session digests as the evidence block for the why prompt. */
export function dossier(input: { entries: Entry[]; sessions: Digest[] }) {
  const entries = input.entries.map(
    (item) => `- [${item.file} > ${item.section} > ${item.key}]${stamp(item.updatedAt)}${taughtBy(item)} ${item.text}`,
  )
  const sessions = input.sessions.map(
    (item) => `- [session ${item.id}${item.topic ? ` > ${item.topic}` : ""}] learned ${item.time}: ${item.summary}`,
  )
  return [
    entries.length ? `## Memory entries\n${entries.join("\n")}` : "",
    sessions.length ? `## Session digests\n${sessions.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

function stamp(ms?: number) {
  if (!ms || ms <= 0) return ""
  return ` (updated ${new Date(ms).toISOString().slice(0, 10)})`
}

function taughtBy(item: Entry) {
  if (!item.sessionID && !item.messageID) return ""
  const parts = [
    ...(item.sessionID ? [`session ${item.sessionID}`] : []),
    ...(item.messageID ? [`message ${item.messageID}`] : []),
  ]
  return ` (taught by ${parts.join(", ")})`
}
