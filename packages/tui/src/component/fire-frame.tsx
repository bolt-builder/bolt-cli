import { createEffect, createMemo, createSignal, onCleanup, Index } from "solid-js"
import { cells, ignite, palette, PALETTE, type Cell } from "../ui/fire"

const INTERVAL = 90

// Drives the fire bar above the chatbox: a DOOM-fire heat grid rendered
// tips-first so the flames lick upward, with the hot source row hugging the
// box. The wasm engine loads asynchronously; until it is ready (or while
// inactive) the grid is empty and nothing renders. When a base color is
// provided the palette is derived from it so the flames match the theme,
// tracking theme changes live.
export function createFire(width: () => number, active: () => boolean, color?: () => string | undefined) {
  const [grid, setGrid] = createSignal<Cell[][]>([])
  const colors = createMemo(() => {
    const base = color?.()
    return base ? palette(base) : PALETTE
  })
  createEffect(() => {
    if (!active()) {
      setGrid([])
      return
    }
    const cols = width()
    let dead = false
    let timer: ReturnType<typeof setInterval> | undefined
    ignite(cols).then((engine) => {
      if (dead) return
      timer = setInterval(() => {
        engine.advance()
        setGrid(cells(engine.grid(), cols, colors()))
      }, INTERVAL)
    })
    onCleanup(() => {
      dead = true
      if (timer) clearInterval(timer)
    })
  })
  return grid
}

export function FireStrip(props: { rows: Cell[][] }) {
  return (
    <box width="100%" overflow="hidden">
      <Index each={props.rows}>
        {(row) => (
          <box height={1} width="100%" overflow="hidden">
            <text>
              <Index each={row()}>{(item) => <span style={{ fg: item().fg, bg: item().bg }}>{item().char}</span>}</Index>
            </text>
          </box>
        )}
      </Index>
    </box>
  )
}
