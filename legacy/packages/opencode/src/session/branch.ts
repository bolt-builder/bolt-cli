import type { MessageID } from "./schema"

// Session.fork copies messages strictly before its messageID argument. To
// branch at a message (inclusive), the fork boundary is the ID of the message
// after the anchor; an undefined boundary copies the entire history. The
// copied prefix stays byte-identical to the original conversation, so the
// model-visible request prefix matches the parent session's and provider
// prompt caches keep hitting on the branch.
export function boundary(messages: { info: { id: MessageID } }[], messageID?: MessageID) {
  if (!messageID) return { fork: undefined }
  const index = messages.findIndex((message) => message.info.id === messageID)
  if (index < 0) return undefined
  return { fork: messages[index + 1]?.info.id }
}

export * as SessionBranch from "./branch"
