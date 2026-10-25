import type { FileDiffInfo, SessionMessageInfo, SessionStatus } from "@bolt-ai/client/promise"

export type SessionDocument = {
  sessionID: string
  messages: SessionMessageInfo[]
  status: SessionStatus
  diffs: FileDiffInfo[]
}
