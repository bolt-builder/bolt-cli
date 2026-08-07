import { describe, expect, test } from "bun:test"
import { order, since } from "../../src/cli/cmd/session"
import type { Session } from "../../src/session/session"

const now = Date.parse("2026-08-07T12:00:00.000Z")

describe("session.list.since", () => {
  test("parses relative minutes", () => {
    expect(since("30m", now)).toBe(now - 30 * 60_000)
  })

  test("parses relative hours", () => {
    expect(since("24h", now)).toBe(now - 24 * 3_600_000)
  })

  test("parses relative days", () => {
    expect(since("7d", now)).toBe(now - 7 * 86_400_000)
  })

  test("parses relative weeks", () => {
    expect(since("2w", now)).toBe(now - 2 * 604_800_000)
  })

  test("parses absolute dates", () => {
    expect(since("2026-01-01", now)).toBe(Date.parse("2026-01-01"))
  })

  test("returns undefined for garbage", () => {
    expect(since("yesterdayish", now)).toBeUndefined()
    expect(since("7x", now)).toBeUndefined()
  })
})

function session(input: { id: string; title: string; created: number; updated: number; cost?: number }) {
  return {
    id: input.id,
    title: input.title,
    cost: input.cost,
    time: { created: input.created, updated: input.updated },
  } as Session.Info
}

const a = session({ id: "ses_a", title: "beta", created: 3, updated: 1, cost: 5 })
const b = session({ id: "ses_b", title: "alpha", created: 1, updated: 3, cost: 0 })
const c = session({ id: "ses_c", title: "gamma", created: 2, updated: 2 })

describe("session.list.order", () => {
  test("defaults to most recently updated", () => {
    expect(order([a, b, c]).map((s) => String(s.id))).toEqual(["ses_b", "ses_c", "ses_a"])
  })

  test("sorts by creation time", () => {
    expect(order([a, b, c], "created").map((s) => String(s.id))).toEqual(["ses_a", "ses_c", "ses_b"])
  })

  test("sorts by title", () => {
    expect(order([a, b, c], "title").map((s) => String(s.id))).toEqual(["ses_b", "ses_a", "ses_c"])
  })

  test("sorts by cost, treating missing cost as zero", () => {
    expect(order([a, b, c], "cost").map((s) => String(s.id))).toEqual(["ses_a", "ses_b", "ses_c"])
  })

  test("does not mutate the input", () => {
    const input = [a, b, c]
    order(input, "title")
    expect(input.map((s) => String(s.id))).toEqual(["ses_a", "ses_b", "ses_c"])
  })
})
