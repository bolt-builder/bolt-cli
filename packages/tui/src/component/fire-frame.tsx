import { createEffect, createMemo, createSignal, onCleanup, Index } from "solid-js"
import { advance, cells, seed, side, type Cell } from "../ui/fire"

const INTERVAL = 90

// Drives the fire border around the chatbox: two independent heat rows
// (top and bottom) plus a flickering side color derived from the top row.
export function createFire(width: () => number, active: () => boolean) {
  const blank = () => ({ top: seed(width()), bottom: seed(width()) })
  const [state, setState] = createSignal(blank())
  createEffect(() => {
    if (!active()) return
    setState(blank())
    const timer = setInterval(
      () =>
        setState((prev) => {
          const fresh = prev.top.length === width() ? prev : blank()
          return { top: advance(fresh.top), bottom: advance(fresh.bottom) }
        }),
      INTERVAL,
    )
    onCleanup(() => clearInterval(timer))
  })
  return {
    top: createMemo(() => cells(state().top)),
    bottom: createMemo(() => cells(state().bottom)),
    side: createMemo(() => side(state().top)),
  }
}

export function FireRow(props: { cells: Cell[] }) {
  return (
    <box height={1} width="100%" overflow="hidden">
      <text>
        <Index each={props.cells}>{(item) => <span style={{ fg: item().color }}>{item().char}</span>}</Index>
      </text>
    </box>
  )
}
