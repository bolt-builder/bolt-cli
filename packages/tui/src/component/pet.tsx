import { MouseButton, rgbToHex } from "@opentui/core"
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
export const TREAT_KEY = "pet_treat"

// KV values are parsed JSON with no runtime validation, so a malformed store
// (a string, an object, junk entries) must degrade to fewer pets, not a crash.
export function roster(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((name): name is string => typeof name === "string" && Object.hasOwn(SPECIES, name))
}

// One styled run of a strip row. Rows are run-length encoded so a mostly
// empty 200-column row costs a few spans instead of one span per cell;
// re-rendering per-cell spans on every tick is what makes a TUI drop frames.
export interface Seg {
  text: string
  fg?: string
  bg?: string
}

interface Critter {
  // Stable identity so interactions stick to the exact individual you
  // grabbed, even when two clones of the same species roam the strip.
  id: number
  species: string
  x: number
  dir: 1 | -1
  mood?: { kind: "love" | "munch" | "held"; until: number }
}

let seq = 0

export interface Treat {
  x: number
  until: number
}

const HEART = "#f472b6"
const HEARTS = ["hh..hh", ".hhhh."]
const COOKIE = { colors: { t: "#c98a3d", k: "#7a4a1d" }, rows: [".tttt.", "ttktkt", ".tttt."] }
const LOVE_MS = 2500
const TREAT_MS = 7000

export function compose(
  crew: Critter[],
  frame: number,
  state: State,
  cols: number,
  warn: string,
  play?: { now: number; treat?: Treat },
): Seg[][] {
  const grid = Array.from({ length: H }, () => new Array<string | undefined>(cols).fill(undefined))
  if (play?.treat && play.treat.until > play.now) {
    for (let r = 0; r < COOKIE.rows.length; r++) {
      const row = COOKIE.rows[r]
      for (let c = 0; c < row.length; c++) {
        const ch = row[c] as keyof typeof COOKIE.colors | "."
        if (ch === ".") continue
        const col = play.treat.x + c
        if (col < 0 || col >= cols) continue
        grid[H - COOKIE.rows.length + r][col] = COOKIE.colors[ch]
      }
    }
  }
  for (const critter of crew) {
    const species = SPECIES[critter.species]
    if (!species) continue
    const mood = play && critter.mood && critter.mood.until > play.now ? critter.mood.kind : undefined
    const frames =
      mood === "love" || mood === "held"
        ? species.states.attention
        : mood === "munch"
          ? species.states.busy
          : species.states[state]
    const art = frames[frame % frames.length]
    const x = Math.round(critter.x)
    for (let r = 0; r < H; r++) {
      const row = art[r]
      for (let c = 0; c < W; c++) {
        const ch = critter.dir < 0 ? row[W - 1 - c] : row[c]
        if (ch === ".") continue
        // A petted pet borrows the wide-eyed attention frames; hearts replace
        // the alarm overlay.
        if (ch === "!" && mood) continue
        const col = x + c
        if (col < 0 || col >= cols) continue
        grid[r][col] = ch === "!" ? warn : species.colors[ch]
      }
    }
    if (mood === "love" && frame % 2 === 0) {
      for (let r = 0; r < HEARTS.length; r++) {
        const row = HEARTS[r]
        for (let c = 0; c < row.length; c++) {
          if (row[c] === ".") continue
          const col = x + 5 + c
          if (col < 0 || col >= cols) continue
          grid[r][col] = HEART
        }
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
  // Never trim rows: the strip must keep a constant height while pets exist.
  // Varying the row count per frame (squish frames, the alert flash) resizes
  // the prompt every tick and forces a full-screen relayout, which stalls the
  // renderer far more than drawing ever does.
  return rows
}

// The strip engine, free of app contexts so tests can drive it with plain
// accessors: spawn reconciliation, the wander/tick interval, and the composed
// rows behind a deep-equal gate so ticks where nothing visibly changed never
// touch the renderer.
export function createStrip(
  width: () => number,
  state: () => State,
  list: () => string[],
  animated: () => boolean,
  warn: () => string,
) {
  const [tick, setTick] = createSignal(0)
  const [crew, setCrew] = createSignal<Critter[]>([])
  const [treat, setTreat] = createSignal<Treat>()

  // Reconcile spawned critters with the persisted list, keeping positions of
  // the ones already on screen so spawning never teleports the others.
  createEffect(() => {
    const names = list()
    const span = Math.max(1, width() - W)
    setCrew((prev) =>
      names.map((name, i) => {
        const old = prev[i]
        if (old && old.species === name) return old
        return { id: ++seq, species: name, x: Math.random() * span, dir: Math.random() < 0.5 ? -1 : 1 } as Critter
      }),
    )
  })

  // Petted or feeding pets animate at play speed even while the session idles.
  const lively = createMemo(() => treat() !== undefined || crew().some((critter) => critter.mood !== undefined))
  const pace = createMemo(() => {
    if (lively() || state() === "busy") return 250
    if (state() === "attention") return 400
    return 800
  })

  createEffect(() => {
    if (!animated() || !list().length) return
    const wait = pace()
    const timer = setInterval(() => {
      const now = Date.now()
      batch(() => {
        setTick((n) => n + 1)
        setTreat((prev) => (prev && prev.until > now ? prev : undefined))
        setCrew((prev) => prev.map((critter) => wander(critter, state(), width(), now, treat())))
      })
    }, wait)
    onCleanup(() => clearInterval(timer))
  })

  const rows = createMemo(
    () => {
      if (!list().length || width() < W) return []
      return compose(crew(), Math.floor(tick() / 2), state(), width(), warn(), { now: Date.now(), treat: treat() })
    },
    [],
    { equals: same },
  )

  return {
    rows,
    crew,
    // Which pet sits under this column? Nearest center wins when clones pile up.
    grab(x: number) {
      const hits = crew().filter((critter) => x >= critter.x && x < critter.x + W)
      const nearest = hits.sort((a, b) => Math.abs(a.x + W / 2 - x) - Math.abs(b.x + W / 2 - x))[0]
      return nearest?.id
    },
    // Pet exactly this individual: wide eyes and hearts.
    poke(id: number) {
      const until = Date.now() + LOVE_MS
      setCrew((prev) =>
        prev.map((critter) => (critter.id === id ? { ...critter, mood: { kind: "love", until } } : critter)),
      )
    },
    // Carry the grabbed pet to a column; it dangles startled until dropped.
    drag(id: number, x: number) {
      const until = Date.now() + 1500
      setCrew((prev) =>
        prev.map((critter) => {
          if (critter.id !== id) return critter
          const goal = Math.min(Math.max(0, width() - W), Math.max(0, x - W / 2))
          const dir = goal === critter.x ? critter.dir : ((goal > critter.x ? 1 : -1) as 1 | -1)
          return { ...critter, x: goal, dir, mood: { kind: "held", until } }
        }),
      )
    },
    drop(id: number) {
      setCrew((prev) =>
        prev.map((critter) =>
          critter.id === id && critter.mood?.kind === "held" ? { ...critter, mood: undefined } : critter,
        ),
      )
    },
    // Spin the pet under this column around.
    turn(x: number) {
      const hits = crew().filter((critter) => x >= critter.x && x < critter.x + W)
      const nearest = hits.sort((a, b) => Math.abs(a.x + W / 2 - x) - Math.abs(b.x + W / 2 - x))[0]
      if (!nearest) return
      setCrew((prev) =>
        prev.map((critter) =>
          critter.id === nearest.id ? { ...critter, dir: (critter.dir * -1) as 1 | -1 } : critter,
        ),
      )
    },
    // Drop a cookie somewhere; everyone scampers over to munch it.
    feed() {
      const max = Math.max(0, width() - COOKIE.rows[0].length)
      setTreat({ x: Math.round(Math.random() * max), until: Date.now() + TREAT_MS })
    },
  }
}

export function PetStrip(props: { sessionID?: string; width: number }) {
  const kv = useKV()
  const sync = useSync()
  const { theme } = useTheme()
  const list = createMemo(() => roster(kv.get(PETS_KEY, [])))
  const state = createMemo<State>(() => {
    const id = props.sessionID ?? ""
    if ((sync.data.permission[id] ?? []).length) return "attention"
    const status = sync.data.session_status?.[id] ?? { type: "idle" }
    if (status.type !== "idle") return "busy"
    return "idle"
  })
  const strip = createStrip(
    () => props.width,
    state,
    list,
    () => kv.get("animations_enabled", true) as boolean,
    () => rgbToHex(theme.warning),
  )

  // The /feed command talks to the strip through a KV nonce; stale values
  // from previous runs are ignored.
  createEffect(() => {
    const nonce = kv.get(TREAT_KEY, 0) as number
    if (!nonce || Date.now() - nonce > 5000) return
    strip.feed()
  })

  // Track the grabbed pet by id so a drag keeps moving the same individual
  // even when a clone wanders under the cursor.
  let held: { id: number; x: number; moved: boolean } | undefined
  const finish = () => {
    if (!held) return
    if (!held.moved) strip.poke(held.id)
    strip.drop(held.id)
    held = undefined
  }

  return (
    <Show when={strip.rows().length}>
      <box
        width="100%"
        overflow="hidden"
        onMouseDown={(evt) => {
          if (evt.button === MouseButton.RIGHT) {
            strip.turn(evt.x)
            return
          }
          const id = strip.grab(evt.x)
          if (id === undefined) return
          held = { id, x: evt.x, moved: false }
        }}
        onMouseDrag={(evt) => {
          if (!held) return
          if (Math.abs(evt.x - held.x) >= 1) held.moved = true
          strip.drag(held.id, evt.x)
        }}
        onMouseDragEnd={finish}
        onMouseUp={finish}
      >
        <Index each={strip.rows()}>
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

function same(a: Seg[][], b: Seg[][]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (row, r) =>
      row.length === b[r].length &&
      row.every((seg, i) => seg.text === b[r][i].text && seg.fg === b[r][i].fg && seg.bg === b[r][i].bg),
  )
}

function wander(critter: Critter, state: State, width: number, now: number, treat?: Treat): Critter {
  const mood = critter.mood && critter.mood.until > now ? critter.mood : undefined
  // Being carried or petted trumps everything: stay exactly where put.
  if (mood?.kind === "held" || mood?.kind === "love") return { ...critter, mood }
  if (treat) {
    const delta = treat.x + 3 - (critter.x + W / 2)
    if (Math.abs(delta) <= 4) return { ...critter, mood: { kind: "munch", until: treat.until } }
    const dir = (delta > 0 ? 1 : -1) as 1 | -1
    return { ...critter, x: critter.x + dir * 2, dir, mood: undefined }
  }
  if (state === "attention") return { ...critter, mood }
  const max = Math.max(0, width - W)
  const flip = state === "busy" ? 0.03 : 0.05
  const dir = Math.random() < flip ? ((critter.dir * -1) as 1 | -1) : critter.dir
  const step = state === "busy" ? 1 : Math.random() < 0.15 ? 1 : 0
  const x = Math.min(max, Math.max(0, critter.x + dir * step))
  const turned = x === critter.x && step > 0 ? ((dir * -1) as 1 | -1) : dir
  return { ...critter, x, dir: turned, mood }
}
