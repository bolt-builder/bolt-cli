import { describe, expect, test } from "bun:test"
import { alive, backoff, probe, verdict } from "../../src/cli/cmd/jobs"

describe("alive", () => {
  test("detects the current process", () => {
    expect(alive(process.pid)).toBe(true)
  })

  test("rejects a zero pid", () => {
    expect(alive(0)).toBe(false)
  })

  test("rejects a pid that cannot exist", () => {
    expect(alive(2 ** 30)).toBe(false)
  })
})

describe("verdict", () => {
  test("restarts immediately when the process is dead", () => {
    expect(verdict({ alive: false, healthy: false }, 0, 3)).toEqual({ action: "restart", failures: 0, reason: "dead" })
  })

  test("dead process restarts even if failures have not accumulated", () => {
    expect(verdict({ alive: false, healthy: false }, 1, 5).action).toBe("restart")
  })

  test("healthy process resets the failure streak", () => {
    expect(verdict({ alive: true, healthy: true }, 2, 3)).toEqual({ action: "ok", failures: 0 })
  })

  test("unhealthy process waits until retries are exhausted", () => {
    expect(verdict({ alive: true, healthy: false }, 0, 3)).toEqual({ action: "wait", failures: 1 })
    expect(verdict({ alive: true, healthy: false }, 1, 3)).toEqual({ action: "wait", failures: 2 })
  })

  test("unhealthy process restarts after N consecutive failures", () => {
    expect(verdict({ alive: true, healthy: false }, 2, 3)).toEqual({
      action: "restart",
      failures: 0,
      reason: "unhealthy",
    })
  })

  test("a single retry restarts on the first failed check", () => {
    expect(verdict({ alive: true, healthy: false }, 0, 1).action).toBe("restart")
  })
})

describe("backoff", () => {
  test("doubles the interval per restart", () => {
    expect(backoff(1, 1000)).toBe(2000)
    expect(backoff(2, 1000)).toBe(4000)
    expect(backoff(3, 1000)).toBe(8000)
  })

  test("caps the delay at 60 seconds", () => {
    expect(backoff(10, 5000)).toBe(60_000)
  })
})

describe("probe", () => {
  test("classifies http and https targets as urls", () => {
    expect(probe("http://localhost:3000/health")).toBe("url")
    expect(probe("https://example.com/ping")).toBe("url")
    expect(probe("  http://localhost/health  ")).toBe("url")
  })

  test("classifies everything else as a command", () => {
    expect(probe("curl -sf localhost:3000/health")).toBe("command")
    expect(probe("test -S /tmp/app.sock")).toBe("command")
  })
})
