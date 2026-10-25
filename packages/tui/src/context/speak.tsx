import { useData } from "./data"
import { useEvent } from "./event"
import { createSimpleContext } from "./helper"
import { useStorage } from "./storage"
import { speak } from "../speak"

// Reads the agent's final answer aloud when a session goes idle, if the user has
// turned "Speak answers" on. Uses the dedicated session.idle event rather than
// session.status so one answer speaks once, regardless of how many busy/retry
// transitions preceded it.
export const { use: useSpeak, provider: SpeakProvider } = createSimpleContext({
  name: "Speak",
  init: () => {
    const data = useData()
    const event = useEvent()
    const [prefs, update] = useStorage().store<{ enabled: boolean }>("speak", {
      initial: { enabled: false },
    })

    function lastAnswer(sessionID: string) {
      const messages = data.session.message.list(sessionID) ?? []
      for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index]
        if (message.type !== "assistant") continue
        const text = message.content
          .flatMap((item) => (item.type === "text" ? [item.text] : []))
          .join("\n")
          .trim()
        if (text) return text
      }
      return undefined
    }

    event.subscribe((e) => {
      if (e.type !== "session.idle") return
      if (!prefs.enabled) return
      const text = lastAnswer(e.data.sessionID)
      if (text) speak.say(text)
    })

    return {
      enabled: () => prefs.enabled,
      toggle: () => update((draft) => void (draft.enabled = !draft.enabled)),
      setEnabled: (value: boolean) => update((draft) => void (draft.enabled = value)),
      stop: () => speak.stop(),
    }
  },
})
