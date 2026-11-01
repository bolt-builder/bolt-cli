import { describe, expect, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Crash } from "../../src/cli/crash"

function directory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bolt-crash-"))
}

describe("crash reports", () => {
  test("build captures the error message and environment", () => {
    const report = Crash.build(new Error("it broke"))
    expect(report.message).toBe("it broke")
    expect(report.stack).toContain("it broke")
    expect(report.platform).toBe(process.platform)
    expect(report.time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test("build redacts secrets from message, stack, and argv", () => {
    const key = "sk-" + "a".repeat(24)
    const error = new Error(`request failed with key ${key}`)
    const report = Crash.build(error)
    expect(report.message).not.toContain(key)
    expect(report.message).toContain("[redacted:api-key]")
    expect(report.stack).not.toContain(key)
  })

  test("write persists a report and returns its path", async () => {
    const dir = directory()
    const file = Crash.write(new Error("boom"), dir)
    expect(fs.existsSync(file)).toBe(true)
    const stored = (await Bun.file(file).json()) as Crash.Report
    expect(stored.message).toBe("boom")
  })

  test("latest returns the newest report", () => {
    const dir = directory()
    expect(Crash.latest(dir)).toBeUndefined()
    Crash.write(new Error("first"), dir)
    const second = Crash.write(new Error("second"), dir)
    expect(Crash.latest(dir)).toBe(second)
  })

  test("write prunes old reports beyond the cap", () => {
    const dir = directory()
    for (const index of Array.from({ length: 15 }, (_, index) => index)) {
      const file = path.join(dir, `2026-01-01T00-00-${String(index).padStart(2, "0")}.000Z-1.json`)
      fs.writeFileSync(file, "{}")
    }
    Crash.write(new Error("newest"), dir)
    const names = fs.readdirSync(dir)
    expect(names.length).toBe(10)
  })

  test("handles non-error values", () => {
    const report = Crash.build("string failure")
    expect(report.message).toBe("string failure")
    expect(report.stack).toBeUndefined()
  })
})
