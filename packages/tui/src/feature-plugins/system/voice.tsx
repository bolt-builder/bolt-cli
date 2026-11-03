import { Plugin } from "@opencode/plugin/tui"
import { BoltVoice } from "@opencode/schema/bolt-voice"
import { onCleanup } from "solid-js"
import { useLocation } from "../../context/location"
import { usePromptRef } from "../../context/prompt"
import { voice } from "../../voice"
import { errorMessage } from "../../util/error"

export default Plugin.define({
  id: "bolt.voice",
  setup(context) {
    const rpc = context.client.rpc(BoltVoice.Definition)
    context.ui.slot({
      append: "app",
      render() {
        const location = useLocation()
        const prompt = usePromptRef()
        onCleanup(() => {
          if (voice.status() === "recording") void voice.reset()
        })
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "prompt.voice",
              title: voice.status() === "recording" ? "Stop voice recording" : "Start voice input",
              group: "Prompt",
              palette: true,
              slash: { name: "voice" },
              async run() {
                if (voice.status() === "transcribing") return
                if (voice.status() === "idle") {
                  const error = voice.start()
                  context.ui.toast.show(
                    error
                      ? { variant: "error", message: error }
                      : { variant: "info", message: "Recording… use /voice again to stop and transcribe." },
                  )
                  return
                }
                const current = prompt.current
                if (!current) {
                  context.ui.toast.show({ variant: "error", message: "Open a prompt to use voice input." })
                  await voice.reset()
                  return
                }
                const target = location.ref
                const route = context.ui.router.current()
                const routeType = route.type
                const sessionID = route.type === "session" ? route.sessionID : undefined
                try {
                  const take = await voice.stop()
                  if (!take.audio) throw new Error(take.error ?? "No audio captured")
                  const result = await rpc.transcribe({ audio: take.audio, mime: "audio/wav" }, { location: target })
                  const active = context.ui.router.current()
                  if (
                    prompt.current !== current ||
                    active.type !== routeType ||
                    (active.type === "session" && active.sessionID !== sessionID)
                  )
                    throw new Error("The prompt changed before voice transcription completed.")
                  current.set({
                    ...current.current,
                    text: [current.current.text, result.text.trim()].filter(Boolean).join(" "),
                  })
                  current.focus()
                } catch (error) {
                  context.ui.toast.show({ variant: "error", message: errorMessage(error) })
                } finally {
                  await voice.reset()
                }
              },
            },
          ],
        }))
        return null
      },
    })
  },
})
