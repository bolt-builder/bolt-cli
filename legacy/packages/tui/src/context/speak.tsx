import { useSync } from "./sync"
import { useEvent } from "./event"
import { useKV } from "./kv"
import { createSimpleContext } from "./helper"
import { speak } from "../speak"

// Reads the agent's final answer aloud when a run finishes, if the user has
// turned "Speak answers" on. Follows the same idle-edge pattern as nudge.tsx:
// busy/retry fire repeatedly within one run, so only the running -> idle
// transition speaks, and only once per run.
export const { use: useSpeak, provider: SpeakProvider } = createSimpleContext({
  name: "Speak",
  init: () => {
    const sync = useSync()
    const event = useEvent()
    const kv = useKV()
    const running = new Set<string>()

    function lastAnswer(sid: string) {
      const messages = sync.data.message[sid] ?? []
      for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index]
        if (message.role !== "assistant") continue
        const text = (sync.data.part[message.id] ?? [])
          .flatMap((part) => (part.type === "text" && !part.synthetic ? [part.text] : []))
          .join("\n")
          .trim()
        if (text) return text
      }
      return undefined
    }

    event.subscribe((e) => {
      switch (e.type) {
        case "session.status": {
          const sid = e.properties.sessionID
          if (e.properties.status.type !== "idle") {
            running.add(sid)
            break
          }
          if (!running.delete(sid)) break
          if (!kv.get("speak_answers_enabled", false)) break
          const text = lastAnswer(sid)
          if (text) speak.say(text)
          break
        }
        case "session.deleted": {
          running.delete(e.properties.info.id)
          break
        }
      }
    })

    return {
      stop: () => speak.stop(),
    }
  },
})
