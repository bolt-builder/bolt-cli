import { Plugin } from "@opencode/plugin/tui"
import { BoltVoice } from "@opencode/schema/bolt-voice"
import { onCleanup } from "solid-js"
import { useLocation } from "../../context/location"
import { usePromptRef } from "../../context/prompt"
import { voice } from "../../voice"

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
                try {
                  const take = await voice.stop()
                  if (!take.audio) throw new Error(take.error ?? "No audio captured")
                  const result = await rpc.transcribe(
                    { audio: take.audio, mime: "audio/wav" },
                    { location: location.ref },
                  )
                  const current = prompt.current
                  if (!current) throw new Error("Open a prompt to use voice input.")
                  current.set({
                    ...current.current,
                    text: [current.current.text, result.text.trim()].filter(Boolean).join(" "),
                  })
                  current.focus()
                } catch (error) {
                  context.ui.toast.show({ variant: "error", message: String(error) })
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
