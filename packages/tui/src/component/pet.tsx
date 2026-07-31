import { rgbToHex } from "@opentui/core"
import { batch, createEffect, createMemo, createSignal, onCleanup, Index, Show } from "solid-js"
import { useKV } from "../context/kv"
import { useSync } from "../context/sync"
import { useTheme } from "../context/theme"

type State = "idle" | "busy" | "attention"

// Pixel-art pets rendered with half-block cells, the same trick the fire
// strip uses: each text row carries two pixel rows ("▀" fg on top, bg on the
// bottom), so a 16x14 sprite is only 16 columns by 7 rows. Sprites are
// palette-indexed string grids ("." transparent, "!" alert overlay) so the
// art lives in code, mirrors for free when a pet turns around, and carries no
// license baggage.
export const W = 16
export const H = 14

const EMPTY = "................"
const BANG = ".......!!......."

const still = (body: string[]) => [EMPTY, EMPTY, ...body]
const alert = (body: string[]) => [BANG, BANG, ...body]
const swap = (body: string[], at: number, row: string) => body.map((line, i) => (i === at ? row : line))

const CAT = [
  "...k........k...",
  "..kdk......kdk..",
  "..kodk....kdok..",
  "..koookkkkoook..",
  ".kooooooooooook.",
  ".kdoooooooooodk.",
  ".koowkooookwook.",
  ".koooowppwooook.",
  ".kooooowwoooook.",
  "..kooooooooook..",
  "..kooooooooook..",
  "..kook....kook..",
]

const DOG = [
  "....kkkkkkkk....",
  "..kkbbbbbbbbkk..",
  ".kdkbbbbbbbbkdk.",
  ".kdkbwkbbkwbkdk.",
  ".kdkbbbbbbbbkdk.",
  ".kkbbwwwwwwbbkk.",
  "..kbbwwkkwwbbk..",
  "..kbbwwppwwbbk..",
  "...kbbbbbbbbk...",
  "..kbbbbbbbbbbk..",
  "..kbbbbbbbbbbk..",
  "..kbk..kk..kbk..",
]

const BLOB = [
  "................",
  ".....kkkkkk.....",
  "...kkggggggkk...",
  "..kggggggggggk..",
  "..kggwkggkwggk..",
  ".kggggggggggggk.",
  ".kggggkkkkggggk.",
  ".kggggggggggggk.",
  ".kggGGGGGGGGggk.",
  ".kGGGGGGGGGGGGk.",
  "..kGGGGGGGGGGk..",
  "...kkkkkkkkkk...",
]

const SQUISH = [
  "................",
  "................",
  "................",
  ".....kkkkkk.....",
  "...kkggggggkk...",
  "..kggwkggkwggk..",
  ".kggggggggggggk.",
  ".kggggkkkkggggk.",
  "kggggggggggggggk",
  "kggGGGGGGGGGGggk",
  "kGGGGGGGGGGGGGGk",
  ".kkkkkkkkkkkkkk.",
]

const GHOST = [
  ".....kkkkkk.....",
  "...kkwwwwwwkk...",
  "..kwwwwwwwwwwk..",
  "..kwweewweewwk..",
  "..kwweewweewwk..",
  "..kwwwwwwwwwwk..",
  "..kwwwwwwwwwwk..",
  "..kwwwwwwwwwwk..",
  "..kswwwwwwwwsk..",
  "..kwwkwwwwkwwk..",
  "...k..kwwk..k...",
  "................",
]

const CRAB = [
  "................",
  "................",
  ".kck.......kck..",
  ".kcck.....kcck..",
  "..kk..kkkk..kk..",
  "...kcccccccck...",
  "..kcwkcccckwck..",
  ".kcccccccccccck.",
  ".kccCCCCCCCCcck.",
  "..kCCCCCCCCCCk..",
  "...kkkkkkkkkk...",
  "..k.k.k..k.k.k..",
]

const sink = (body: string[]) => [EMPTY, ...body.slice(0, body.length - 1)]

const catWide = swap(CAT, 6, ".koowwoooowwook.")
const dogWide = swap(DOG, 3, ".kdkbwwbbwwbkdk.")
const blobWide = swap(BLOB, 4, "..kgwwggggwwgk..")
const ghostSing = swap(swap(GHOST, 5, "..kwwwwmmwwwwk.."), 6, "..kwwwwmmwwwwk..")
const crabWide = swap(CRAB, 6, "..kcwwccccwwck..")
const crabStep = swap(swap(swap(CRAB, 11, ".k.k.k....k.k.k."), 2, "kck.........kck."), 3, "kcck.......kcck.")

export interface Species {
  colors: Record<string, string>
  states: Record<State, string[][]>
}

export const SPECIES: Record<string, Species> = {
  cat: {
    colors: { k: "#1c1917", o: "#f0983a", d: "#c2611e", w: "#f7f3e8", p: "#e78ea9" },
    states: {
      idle: [still(CAT), still(swap(CAT, 6, ".kooddooooddook."))],
      busy: [still(swap(CAT, 11, ".kook..kk..kook.")), still(swap(CAT, 11, "..kook.kk.kook.."))],
      attention: [alert(catWide), still(catWide)],
    },
  },
  dog: {
    colors: { k: "#1c1917", b: "#b0793a", d: "#7c4a21", w: "#f7f3e8", p: "#e78ea9" },
    states: {
      idle: [still(DOG), still(swap(DOG, 3, ".kdkbkkbbkkbkdk."))],
      busy: [still(swap(DOG, 11, ".kbk...kk...kbk.")), still(DOG)],
      attention: [alert(dogWide), still(dogWide)],
    },
  },
  blob: {
    colors: { k: "#1c1917", g: "#5fd68b", G: "#2f9e5f", w: "#f7f3e8" },
    states: {
      idle: [still(BLOB), still(swap(BLOB, 4, "..kggkkggkkggk.."))],
      busy: [still(BLOB), still(SQUISH)],
      attention: [alert(blobWide), still(blobWide)],
    },
  },
  ghost: {
    colors: { k: "#2b3a55", w: "#e8edf7", s: "#b9c6e0", e: "#2b3a55", m: "#8fa3c8" },
    states: {
      idle: [still(GHOST), still(sink(GHOST))],
      busy: [still(ghostSing), still(sink(ghostSing))],
      attention: [alert(GHOST), still(GHOST)],
    },
  },
  crab: {
    colors: { k: "#1c1917", c: "#e2574c", C: "#a93226", w: "#f7f3e8" },
    states: {
      idle: [still(CRAB), still(swap(CRAB, 6, "..kckkcccckkck.."))],
      busy: [still(CRAB), still(crabStep)],
      attention: [alert(crabWide), still(crabWide)],
    },
  },
}

export const PETS_KEY = "pets"

// One styled run of a strip row. Rows are run-length encoded so a mostly
// empty 200-column row costs a few spans instead of one span per cell;
// re-rendering per-cell spans on every tick is what makes a TUI drop frames.
export interface Seg {
  text: string
  fg?: string
  bg?: string
}

interface Critter {
  species: string
  x: number
  dir: 1 | -1
}

export function compose(crew: Critter[], frame: number, state: State, cols: number, warn: string): Seg[][] {
  const grid = Array.from({ length: H }, () => new Array<string | undefined>(cols).fill(undefined))
  for (const critter of crew) {
    const species = SPECIES[critter.species]
    if (!species) continue
    const frames = species.states[state]
    const art = frames[frame % frames.length]
    const x = Math.round(critter.x)
    for (let r = 0; r < H; r++) {
      const row = art[r]
      for (let c = 0; c < W; c++) {
        const ch = critter.dir < 0 ? row[W - 1 - c] : row[c]
        if (ch === ".") continue
        const col = x + c
        if (col < 0 || col >= cols) continue
        grid[r][col] = ch === "!" ? warn : species.colors[ch]
      }
    }
  }
  const rows: Seg[][] = []
  for (let r = 0; r < H; r += 2) {
    const line: Seg[] = []
    let text = ""
    let fg: string | undefined
    let bg: string | undefined
    const flush = () => {
      if (text) line.push({ text, fg, bg })
      text = ""
    }
    for (let c = 0; c < cols; c++) {
      const top = grid[r][c]
      const bottom = grid[r + 1][c]
      const char = top ? "▀" : bottom ? "▄" : " "
      const nextFg = top ?? bottom
      const nextBg = top ? bottom : undefined
      if (text && (nextFg !== fg || nextBg !== bg)) flush()
      fg = nextFg
      bg = nextBg
      text += char
    }
    flush()
    rows.push(line)
  }
  const blank = (row: Seg[]) => row.every((seg) => !seg.fg && !seg.bg && seg.text.trim() === "")
  while (rows.length && blank(rows[0])) rows.shift()
  return rows
}

export function PetStrip(props: { sessionID?: string; width: number }) {
  const kv = useKV()
  const sync = useSync()
  const { theme } = useTheme()
  const [tick, setTick] = createSignal(0)
  const [crew, setCrew] = createSignal<Critter[]>([])
  const list = createMemo(() => (kv.get(PETS_KEY, []) as string[]).filter((name) => SPECIES[name] !== undefined))
  const state = createMemo<State>(() => {
    const id = props.sessionID ?? ""
    if ((sync.data.permission[id] ?? []).length) return "attention"
    const status = sync.data.session_status?.[id] ?? { type: "idle" }
    if (status.type !== "idle") return "busy"
    return "idle"
  })
  const animated = createMemo(() => kv.get("animations_enabled", true))

  // Reconcile spawned critters with the persisted list, keeping positions of
  // the ones already on screen so spawning never teleports the others.
  createEffect(() => {
    const names = list()
    const span = Math.max(1, props.width - W)
    setCrew((prev) =>
      names.map((name, i) => {
        const old = prev[i]
        if (old && old.species === name) return old
        return { species: name, x: Math.random() * span, dir: Math.random() < 0.5 ? -1 : 1 } as Critter
      }),
    )
  })

  createEffect(() => {
    if (!animated() || !list().length) return
    const pace = state() === "busy" ? 200 : state() === "attention" ? 350 : 600
    const timer = setInterval(() => {
      batch(() => {
        setTick((n) => n + 1)
        setCrew((prev) => prev.map((critter) => wander(critter, state(), props.width)))
      })
    }, pace)
    onCleanup(() => clearInterval(timer))
  })

  const rows = createMemo(() => {
    if (!list().length || props.width < W) return []
    return compose(crew(), Math.floor(tick() / 2), state(), props.width, rgbToHex(theme.warning))
  })

  return (
    <Show when={rows().length}>
      <box width="100%" overflow="hidden">
        <Index each={rows()}>
          {(row) => (
            <box height={1} width="100%" overflow="hidden">
              <text>
                <Index each={row()}>{(seg) => <span style={{ fg: seg().fg, bg: seg().bg }}>{seg().text}</span>}</Index>
              </text>
            </box>
          )}
        </Index>
      </box>
    </Show>
  )
}

function wander(critter: Critter, state: State, width: number): Critter {
  if (state === "attention") return critter
  const max = Math.max(0, width - W)
  const flip = state === "busy" ? 0.03 : 0.05
  const dir = Math.random() < flip ? ((critter.dir * -1) as 1 | -1) : critter.dir
  const step = state === "busy" ? 1 : Math.random() < 0.15 ? 1 : 0
  const x = Math.min(max, Math.max(0, critter.x + dir * step))
  const turned = x === critter.x && step > 0 ? ((dir * -1) as 1 | -1) : dir
  return { species: critter.species, x, dir: turned }
}
