import { describe, expect, test } from "bun:test"
import { args, seconds, spread } from "../../src/tool/frames"

describe("frames.seconds", () => {
  test("parses plain seconds", () => {
    expect(seconds("90")).toBe(90)
    expect(seconds("12.5")).toBe(12.5)
    expect(seconds("0")).toBe(0)
  })

  test("parses minutes:seconds", () => {
    expect(seconds("1:30")).toBe(90)
    expect(seconds("0:05")).toBe(5)
    expect(seconds("10:00.5")).toBe(600.5)
  })

  test("parses hours:minutes:seconds", () => {
    expect(seconds("1:02:03.5")).toBe(3723.5)
    expect(seconds("2:00:00")).toBe(7200)
  })

  test("rejects out-of-range and malformed stamps", () => {
    expect(seconds("1:75")).toBeUndefined()
    expect(seconds("1:02:60")).toBeUndefined()
    expect(seconds("abc")).toBeUndefined()
    expect(seconds("-5")).toBeUndefined()
    expect(seconds("1:2:3:4")).toBeUndefined()
    expect(seconds("")).toBeUndefined()
  })
})

describe("frames.spread", () => {
  test("centers evenly spaced points in each slice", () => {
    expect(spread(10, 2)).toEqual([2.5, 7.5])
    expect(spread(9, 3)).toEqual([1.5, 4.5, 7.5])
  })

  test("avoids the very start and end of the video", () => {
    const points = spread(60, 4)
    expect(points[0]).toBeGreaterThan(0)
    expect(points[points.length - 1]).toBeLessThan(60)
  })

  test("returns nothing for empty or invalid inputs", () => {
    expect(spread(0, 3)).toEqual([])
    expect(spread(10, 0)).toEqual([])
    expect(spread(-1, 2)).toEqual([])
  })
})

describe("frames.args", () => {
  test("seeks before the input for fast keyframe extraction", () => {
    const built = args("/tmp/repro.mp4", 12.5, "/tmp/out/frame-001.png")
    expect(built.indexOf("-ss")).toBeLessThan(built.indexOf("-i"))
    expect(built[built.indexOf("-ss") + 1]).toBe("12.5")
    expect(built[built.indexOf("-i") + 1]).toBe("/tmp/repro.mp4")
  })

  test("extracts exactly one frame and overwrites the output", () => {
    const built = args("/tmp/repro.mp4", 5, "/tmp/out/frame-001.png")
    expect(built[built.indexOf("-frames:v") + 1]).toBe("1")
    expect(built).toContain("-y")
    expect(built[built.length - 1]).toBe("/tmp/out/frame-001.png")
  })
})
