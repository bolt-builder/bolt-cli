import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js"
import { useKV } from "../context/kv"
import { useSync } from "../context/sync"
import { useTheme } from "../context/theme"

type State = "idle" | "busy" | "attention"

// Text-art pets so they render in every terminal, unlike graphics-protocol
// pets. Frames within a state are kept the same width to avoid layout shift.
export const PETS: Record<string, Record<State, string[]>> = {
  cat: {
    idle: ["(=^･ω･^=)", "(=^-ω-^=)"],
    busy: ["(=^･ω･^=)ﾉ", "(=^･ω･^=)ゞ"],
    attention: ["(=ﾟωﾟ=) ?", "(=ﾟωﾟ=) !"],
  },
  dog: {
    idle: ["(´･ᴥ･`)", "(´-ᴥ-`)"],
    busy: ["ᕕ(´･ᴥ･`)ᕗ", "ᕗ(´･ᴥ･`)ᕕ"],
    attention: ["(´ºᴥº`) ?", "(´ºᴥº`) !"],
  },
  blob: {
    idle: ["( ˘ω˘ )", "( ˘‿˘ )"],
    busy: ["(ﾉ´ヮ`)ﾉ*", "ヽ(´ヮ´)ノ*"],
    attention: ["(⊙_⊙) ?", "(⊙_⊙) !"],
  },
}

export const PET_KEY = "pet"
export const PET_OFF = "off"

export function Pet(props: { sessionID?: string }) {
  const kv = useKV()
  const sync = useSync()
  const { theme } = useTheme()
  const [tick, setTick] = createSignal(0)
  const pet = createMemo(() => PETS[kv.get(PET_KEY, PET_OFF) as string])
  const state = createMemo<State>(() => {
    const id = props.sessionID ?? ""
    if ((sync.data.permission[id] ?? []).length) return "attention"
    const status = sync.data.session_status?.[id] ?? { type: "idle" }
    if (status.type !== "idle") return "busy"
    return "idle"
  })
  const animated = createMemo(() => kv.get("animations_enabled", true) && pet() !== undefined)
  createEffect(() => {
    if (!animated()) return
    // Blink slowly while idle, scamper while working or waiting for input.
    const interval = setInterval(() => setTick((n) => n + 1), state() === "idle" ? 1500 : 500)
    onCleanup(() => clearInterval(interval))
  })
  const frame = createMemo(() => {
    const frames = pet()?.[state()] ?? []
    if (!frames.length) return undefined
    return frames[tick() % frames.length]
  })
  const color = createMemo(() => {
    if (state() === "attention") return theme.warning
    if (state() === "busy") return theme.primary
    return theme.textMuted
  })
  return (
    <Show when={frame()}>
      <text flexShrink={0} fg={color()}>
        {frame()}
      </text>
    </Show>
  )
}
