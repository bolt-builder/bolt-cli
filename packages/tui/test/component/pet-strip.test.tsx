/** @jsxImportSource @opentui/solid */
import { afterEach, expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { render } from "@opentui/solid"
import { createSignal, Index, Show } from "solid-js"
import { createStrip, type Seg } from "../../src/component/pet"

// Destroy the renderer even when an assertion throws mid-test; otherwise the
// strip's setInterval keeps ticking and the process never settles.
let cleanup: (() => void) | undefined
afterEach(() => cleanup?.())

test("animated pet strip keeps rendering fast frames", async () => {
  const setup = await createTestRenderer({ width: 120, height: 30, useThread: false })
  cleanup = () => setup.renderer.destroy()
  const [state, setState] = createSignal<"idle" | "busy" | "attention">("idle")
  const [list, setList] = createSignal<string[]>([])
  let strip!: ReturnType<typeof createStrip>
  render(() => {
    strip = createStrip(() => 120, state, list, () => true, () => "#fbbf24")
    return (
      <box width="100%">
        <Show when={strip.rows().length}>
          <Index each={strip.rows()}>
            {(row) => (
              <box height={1} width="100%" overflow="hidden">
                <text>
                  <Index each={row()}>
                    {(seg) => <span style={{ fg: seg().fg, bg: seg().bg }}>{seg().text}</span>}
                  </Index>
                </text>
              </box>
            )}
          </Index>
        </Show>
      </box>
    )
  }, setup.renderer)
  await setup.renderOnce()

  // Spawn one pet mid-flight, like the dialog does.
  let start = performance.now()
  setList(["cat"])
  await setup.renderOnce()
  console.log("spawn render ms:", (performance.now() - start).toFixed(1))
  expect(strip.rows().length).toBe(7)

  // Let real intervals tick across state paces and confirm frames stay cheap.
  for (const phase of ["idle", "busy", "attention"] as const) {
    setState(phase)
    const deadline = Date.now() + 1200
    let frames = 0
    let worst = 0
    while (Date.now() < deadline) {
      const t = performance.now()
      await setup.renderOnce()
      worst = Math.max(worst, performance.now() - t)
      frames++
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    console.log(`${phase}: ${frames} frames, worst render ms:`, worst.toFixed(1))
    expect(worst).toBeLessThan(100)
  }

  // Spawn a full litter and hammer it in busy mode.
  setList(["cat", "dog", "blob", "ghost", "crab", "cat", "dog", "blob", "ghost", "crab"])
  setState("busy")
  start = performance.now()
  await setup.renderOnce()
  console.log("10-pet spawn render ms:", (performance.now() - start).toFixed(1))
  const deadline = Date.now() + 1500
  let worst = 0
  while (Date.now() < deadline) {
    const t = performance.now()
    await setup.renderOnce()
    worst = Math.max(worst, performance.now() - t)
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
  console.log("10 pets busy worst render ms:", worst.toFixed(1))
  expect(worst).toBeLessThan(100)
  expect(setup.captureCharFrame()).toContain("▀")
}, 30000)

test("poking a pet shows hearts and feeding drops a cookie they run to", async () => {
  const setup = await createTestRenderer({ width: 120, height: 30, useThread: false })
  const [list] = createSignal<string[]>(["cat"])
  let strip!: ReturnType<typeof createStrip>
  render(() => {
    strip = createStrip(() => 120, () => "idle", list, () => true, () => "#fbbf24")
    return (
      <box width="100%">
        <Index each={strip.rows()}>
          {(row) => (
            <box height={1} width="100%">
              <text>
                <Index each={row()}>
                  {(seg) => <span style={{ fg: seg().fg, bg: seg().bg }}>{seg().text}</span>}
                </Index>
              </text>
            </box>
          )}
        </Index>
      </box>
    )
  }, setup.renderer)
  await setup.renderOnce()

  const colors = () => new Set(strip.rows().flat().flatMap((seg) => [seg.fg, seg.bg]))

  // Poke every column so the cat is hit wherever it spawned.
  for (let x = 0; x < 120; x += 8) strip.poke(x)
  await setup.waitFor(() => colors().has("#f472b6"), { maxPasses: 100 })

  strip.feed()
  await setup.waitFor(() => colors().has("#c98a3d"), { maxPasses: 100 })

  // The cat should reach the cookie and munch within the treat window.
  await setup.waitFor(
    () => {
      const rows = strip.rows()
      return rows.length > 0 && colors().has("#c98a3d")
    },
    { maxPasses: 200 },
  )

  setup.renderer.destroy()
}, 30000)
