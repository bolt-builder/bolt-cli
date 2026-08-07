import { describe, expect, test } from "bun:test"
import { Budget } from "@/cli/cmd/run/budget"

const step = (cost: number, tokens: Partial<Budget.StepUsage["tokens"]> = {}) => ({
  cost,
  tokens: {
    input: 0,
    output: 0,
    reasoning: 0,
    cache: { read: 0, write: 0 },
    ...tokens,
  },
})

describe("budget.add", () => {
  test("prefers the total token count when present", () => {
    const state = Budget.add(Budget.empty, step(0.5, { total: 1200, input: 1 }))
    expect(state).toEqual({ cost: 0.5, tokens: 1200 })
  })

  test("sums token categories including cache when total is missing", () => {
    const state = Budget.add(Budget.empty, step(0.1, { input: 100, output: 50, reasoning: 25, cache: { read: 10, write: 5 } }))
    expect(state).toEqual({ cost: 0.1, tokens: 190 })
  })

  test("accumulates across steps", () => {
    const first = Budget.add(Budget.empty, step(0.25, { total: 100 }))
    const second = Budget.add(first, step(0.75, { total: 400 }))
    expect(second).toEqual({ cost: 1, tokens: 500 })
  })
})

describe("budget.exceeded", () => {
  test("returns undefined while within budget", () => {
    expect(Budget.exceeded({ cost: 0.5, tokens: 100 }, { cost: 1, tokens: 200 })).toBeUndefined()
    expect(Budget.exceeded({ cost: 100, tokens: 1e9 }, {})).toBeUndefined()
  })

  test("reports the cost breach first", () => {
    expect(Budget.exceeded({ cost: 1, tokens: 500 }, { cost: 1, tokens: 200 })).toContain("cost budget exceeded")
  })

  test("reports token breaches", () => {
    expect(Budget.exceeded({ cost: 0, tokens: 200 }, { tokens: 200 })).toContain("token budget exceeded")
  })
})
