import { createEffect, createSignal, on, onCleanup, type Accessor } from "solid-js"

export function createDebouncedSignal<T>(value: T, ms: number): [Accessor<T>, (value: T) => void] {
  const [get, set] = createSignal(value)
  let timer: ReturnType<typeof setTimeout> | undefined
  const debounced = (next: T) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      set(() => next)
    }, ms)
  }
  onCleanup(() => {
    if (timer) clearTimeout(timer)
  })
  return [get, debounced]
}

/** Breathing 0..1 wave while active; holds 1 when active with animations off. */
export function createPulse(active: Accessor<boolean>, enabled: Accessor<boolean>, period = 1600) {
  const [value, setValue] = createSignal(0)

  createEffect(
    on([active, enabled], ([run, animate]) => {
      if (!run || !animate) {
        setValue(run ? 1 : 0)
        return
      }

      // Reset so re-enabling animations mid-activity starts the wave at 0
      // instead of holding the steady value 1 until the first tick.
      setValue(0)
      const start = performance.now()
      const timer = setInterval(() => {
        const phase = ((performance.now() - start) % period) / period
        setValue(0.5 - Math.cos(phase * Math.PI * 2) / 2)
      }, 50)

      onCleanup(() => clearInterval(timer))
    }),
  )

  return value
}

export function createFadeIn(show: Accessor<boolean>, enabled: Accessor<boolean>) {
  const [alpha, setAlpha] = createSignal(show() ? 1 : 0)
  let revealed = show()

  createEffect(
    on([show, enabled], ([visible, animate]) => {
      if (!visible) {
        setAlpha(0)
        return
      }

      if (!animate || revealed) {
        revealed = true
        setAlpha(1)
        return
      }

      const start = performance.now()
      revealed = true
      setAlpha(0)

      const timer = setInterval(() => {
        const progress = Math.min((performance.now() - start) / 160, 1)
        setAlpha(progress * progress * (3 - 2 * progress))
        if (progress >= 1) clearInterval(timer)
      }, 16)

      onCleanup(() => clearInterval(timer))
    }),
  )

  return alpha
}
