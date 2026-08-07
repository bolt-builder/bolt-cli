/** Pure decay scoring for stored facts: confidence halves every half-life until reconfirmed.
 * A fact is reconfirmed whenever it is written again (MemoryStamps refreshes its updatedAt). */
export const HALF_LIFE_DAYS = 45

/** Facts older than two half-lives (score below 0.25) are considered stale. */
export const STALE_SCORE = 0.25

const DAY = 86_400_000

export function score(input: { updatedAt: number; now: number; halfLifeDays?: number }) {
  const half = input.halfLifeDays ?? HALF_LIFE_DAYS
  if (half <= 0) return 1
  const age = Math.max(0, input.now - input.updatedAt)
  return Math.pow(0.5, age / (half * DAY))
}

/** Unknown ages (updatedAt of 0 or missing) never count as stale: absence of a stamp is not evidence of age. */
export function stale(input: { updatedAt?: number; now: number; halfLifeDays?: number }) {
  if (!input.updatedAt) return false
  return score({ updatedAt: input.updatedAt, now: input.now, halfLifeDays: input.halfLifeDays }) < STALE_SCORE
}

export * as MemoryDecay from "./decay"
