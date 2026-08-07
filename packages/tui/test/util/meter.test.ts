import { describe, expect, test } from "bun:test"
import { meter } from "../../src/util/meter"

describe("util.meter", () => {
  test("renders an empty meter at zero", () => {
    expect(meter(0)).toBe("▱▱▱▱▱")
  })

  test("renders a full meter at one hundred", () => {
    expect(meter(100)).toBe("▰▰▰▰▰")
  })

  test("rounds to the nearest block", () => {
    expect(meter(45)).toBe("▰▰▱▱▱")
    expect(meter(50)).toBe("▰▰▰▱▱")
    expect(meter(79)).toBe("▰▰▰▰▱")
    expect(meter(90)).toBe("▰▰▰▰▰")
  })

  test("clamps out-of-range percentages", () => {
    expect(meter(-20)).toBe("▱▱▱▱▱")
    expect(meter(250)).toBe("▰▰▰▰▰")
  })

  test("supports custom widths", () => {
    expect(meter(50, 10)).toBe("▰▰▰▰▰▱▱▱▱▱")
    expect(meter(100, 2)).toBe("▰▰")
  })
})
