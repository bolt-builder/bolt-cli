import type { Message } from "./protocol"

// The persisted chat transcript is capped so workspaceState stays small.
export const CAP = 50

export function append(messages: readonly Message[], message: Message) {
  return [...messages, message].slice(-CAP)
}
