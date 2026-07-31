import { createEffect, createMemo, createSignal, onCleanup, Index } from "solid-js"
import { advance, cells, seed, side, type Cell } from "../ui/fire"

const INTERVAL = 90

// Drives the fire border around the chatbox: two independent DOOM-fire grids.
// The top strip is rendered tips-first so flames lick upward; the bottom strip
// is rendered reversed so flames lick downward. The fire always faces outward.
export function createFire(width: () => number, active: () => boolean) {
  const blank = () => ({ top: seed(width()), bottom: seed(width()) })
  const [state, setState] = createSignal(blank())
  createEffect(() => {
    if (!active()) return
    setState(blank())
    const timer = setInterval(
      () =>
        setState((prev) => {
          const fresh = (prev.top[0]?.length ?? 0) === width() ? prev : blank()
          return { top: advance(fresh.top), bottom: advance(fresh.bottom) }
        }),
      INTERVAL,
    )
    onCleanup(() => clearInterval(timer))
  })
  return {
    top: createMemo(() => cells(state().top)),
    bottom: createMemo(() => cells(state().bottom).toReversed()),
    side: createMemo(() => side(state().top)),
  }
}

export function FireStrip(props: { rows: Cell[][] }) {
  return (
    <box width="100%" overflow="hidden">
      <Index each={props.rows}>
        {(row) => (
          <box height={1} width="100%" overflow="hidden">
            <text>
              <Index each={row()}>{(item) => <span style={{ fg: item().color }}>{item().char}</span>}</Index>
            </text>
          </box>
        )}
      </Index>
    </box>
  )
}
