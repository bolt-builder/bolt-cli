import { describe, expect, test } from "bun:test"
import { filter, level } from "../../src/cli/cmd/logs"

const info = "timestamp=2026-08-07T18:51:46.677Z level=INFO run=91e0988c message=loading"
const error = "timestamp=2026-08-07T18:51:46.677Z level=ERROR run=91e0988c message=boom session.id=ses_123"
const debug = "timestamp=2026-08-07T18:51:46.677Z level=DEBUG run=91e0988c message=noise session.id=ses_456"

describe("logs level parsing", () => {
  test("extracts the level field", () => {
    expect(level(info)).toBe("INFO")
    expect(level(error)).toBe("ERROR")
  })

  test("returns undefined for lines without a level", () => {
    expect(level("    at foo (bar.ts:1:1)")).toBeUndefined()
  })
})

describe("logs filter", () => {
  test("keeps everything by default", () => {
    const keep = filter({})
    expect(keep(info)).toBe(true)
    expect(keep(debug)).toBe(true)
  })

  test("applies minimum level", () => {
    const keep = filter({ level: "WARN" })
    expect(keep(info)).toBe(false)
    expect(keep(error)).toBe(true)
    expect(keep(debug)).toBe(false)
  })

  test("filters by session id", () => {
    const keep = filter({ session: "ses_123" })
    expect(keep(error)).toBe(true)
    expect(keep(debug)).toBe(false)
    expect(keep(info)).toBe(false)
  })

  test("combines level and session filters", () => {
    const keep = filter({ level: "DEBUG", session: "ses_456" })
    expect(keep(debug)).toBe(true)
    expect(keep(error)).toBe(false)
  })

  test("continuation lines inherit the previous decision", () => {
    const keep = filter({ level: "ERROR" })
    expect(keep(error)).toBe(true)
    expect(keep("    at foo (bar.ts:1:1)")).toBe(true)
    expect(keep(info)).toBe(false)
    expect(keep("    at foo (bar.ts:1:1)")).toBe(false)
  })
})
