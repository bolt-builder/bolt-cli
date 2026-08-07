import { describe, expect, test } from "bun:test"
import { compare, normalize, render, stats } from "../../src/cli/cmd/bench"

describe("stats", () => {
  test("summarizes a single sample", () => {
    expect(stats([100])).toEqual({ mean: 100, stddev: 0, min: 100, max: 100 })
  })

  test("computes mean, stddev, min, and max", () => {
    const summary = stats([100, 200])
    expect(summary.mean).toBe(150)
    expect(summary.stddev).toBe(50)
    expect(summary.min).toBe(100)
    expect(summary.max).toBe(200)
  })
})

describe("compare", () => {
  test("flags a slowdown beyond the threshold as a regression", () => {
    expect(compare(100, 120, 10).verdict).toBe("regression")
  })

  test("flags a speedup beyond the threshold as an improvement", () => {
    expect(compare(100, 80, 10).verdict).toBe("improvement")
  })

  test("treats changes within the threshold as neutral", () => {
    expect(compare(100, 105, 10).verdict).toBe("neutral")
    expect(compare(100, 95, 10).verdict).toBe("neutral")
  })

  test("boundary values are neutral, not regressions", () => {
    expect(compare(100, 110, 10).verdict).toBe("neutral")
    expect(compare(100, 90, 10).verdict).toBe("neutral")
  })

  test("reports the head to base ratio", () => {
    expect(compare(100, 150, 10).ratio).toBe(1.5)
  })
})

describe("normalize", () => {
  test("rejects non-finite runs and warmup", () => {
    expect(normalize({ runs: Infinity, warmup: 1, threshold: 10 })).toBeTypeOf("string")
    expect(normalize({ runs: 5, warmup: Infinity, threshold: 10 })).toBeTypeOf("string")
    expect(normalize({ runs: Number.NaN, warmup: 1, threshold: 10 })).toBeTypeOf("string")
  })

  test("rejects negative and non-finite thresholds", () => {
    expect(normalize({ runs: 5, warmup: 1, threshold: -1 })).toBeTypeOf("string")
    expect(normalize({ runs: 5, warmup: 1, threshold: Infinity })).toBeTypeOf("string")
    expect(normalize({ runs: 5, warmup: 1, threshold: Number.NaN })).toBeTypeOf("string")
  })

  test("floors fractional values and clamps to minimums", () => {
    expect(normalize({ runs: 3.7, warmup: 1.2, threshold: 10 })).toEqual({ runs: 3, warmup: 1, threshold: 10 })
    expect(normalize({ runs: 0, warmup: -2, threshold: 0 })).toEqual({ runs: 1, warmup: 0, threshold: 0 })
  })
})

describe("render", () => {
  test("formats a stats line in milliseconds", () => {
    expect(render(stats([100, 200]))).toBe("mean 150.0ms (stddev 50.0ms, min 100.0ms, max 200.0ms)")
  })
})
