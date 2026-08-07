import { describe, expect, test } from "bun:test"
import { marker } from "../../src/cli/cmd/guard"

describe("marker", () => {
  test("parses a test marker", () => {
    const text = "Created the repro.\n\nTest: test/cli/parse.test.ts\nCommand: bun test ./test/cli/parse.test.ts"
    expect(marker(text, "Test")).toBe("test/cli/parse.test.ts")
  })

  test("parses a command marker", () => {
    const text = "Test: test/a.test.ts\nCommand: bun test ./test/a.test.ts"
    expect(marker(text, "Command")).toBe("bun test ./test/a.test.ts")
  })

  test("is case insensitive", () => {
    expect(marker("test: test/a.test.ts", "Test")).toBe("test/a.test.ts")
  })

  test("uses the last marker when several appear", () => {
    const text = 'End with "Test: <path>".\nTest: wrong.ts\nTest: right.test.ts'
    expect(marker(text, "Test")).toBe("right.test.ts")
  })

  test("strips surrounding backticks", () => {
    expect(marker("Test: `test/a.test.ts`", "Test")).toBe("test/a.test.ts")
  })

  test("returns undefined when the marker is missing", () => {
    expect(marker("No markers here.", "Test")).toBeUndefined()
  })

  test("returns undefined for an empty value", () => {
    expect(marker("Test: ``", "Test")).toBeUndefined()
  })

  test("does not confuse different marker names", () => {
    const text = "Command: bun test ./test/a.test.ts"
    expect(marker(text, "Test")).toBeUndefined()
  })
})
