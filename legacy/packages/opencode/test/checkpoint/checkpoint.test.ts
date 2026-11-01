import { describe, expect, test } from "bun:test"
import { validName, next } from "@/checkpoint"
import { age } from "@/cli/cmd/checkpoint"

describe("validName", () => {
  test("accepts simple slugs", () => {
    expect(validName("before-refactor")).toBe(true)
    expect(validName("v1.2.3")).toBe(true)
    expect(validName("WIP_2")).toBe(true)
    expect(validName("a")).toBe(true)
  })

  test("rejects empty and unsafe names", () => {
    expect(validName("")).toBe(false)
    expect(validName(".hidden")).toBe(false)
    expect(validName("-flag")).toBe(false)
    expect(validName("a/b")).toBe(false)
    expect(validName("a b")).toBe(false)
    expect(validName("a".repeat(65))).toBe(false)
  })
})

describe("next", () => {
  test("returns the first id after the marker", () => {
    expect(next(["msg_01", "msg_02", "msg_03"], "msg_02")).toBe("msg_03")
  })

  test("returns undefined when nothing came after the checkpoint", () => {
    expect(next(["msg_01", "msg_02"], "msg_02")).toBeUndefined()
    expect(next([], "msg_02")).toBeUndefined()
  })

  test("rewinds everything when the marker predates all messages", () => {
    expect(next(["msg_05", "msg_06"], "msg_01")).toBe("msg_05")
  })
})

describe("age", () => {
  test("formats seconds, minutes, hours, and days", () => {
    const now = 1_000_000_000_000
    expect(age(now, now - 5_000)).toBe("5s ago")
    expect(age(now, now - 90_000)).toBe("1m ago")
    expect(age(now, now - 2 * 60 * 60 * 1000)).toBe("2h ago")
    expect(age(now, now - 3 * 24 * 60 * 60 * 1000)).toBe("3d ago")
  })

  test("clamps future timestamps to zero", () => {
    expect(age(0, 1000)).toBe("0s ago")
  })
})
