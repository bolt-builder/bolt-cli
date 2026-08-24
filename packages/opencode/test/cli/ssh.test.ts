import { describe, expect, test } from "bun:test"
import { args, endpoint, explain, parse } from "../../src/cli/ssh"

describe("parse", () => {
  test("parses ssh urls with user and port", () => {
    expect(parse("ssh://dev@dev-box:2222")).toEqual({ destination: "dev@dev-box", port: 2222 })
  })

  test("parses ssh urls without user or port", () => {
    expect(parse("ssh://dev-box")).toEqual({ destination: "dev-box" })
  })

  test("accepts bare destinations", () => {
    expect(parse("dev@dev-box")).toEqual({ destination: "dev@dev-box" })
  })

  test("rejects other schemes and empty hosts", () => {
    expect(parse("http://dev-box")).toBeUndefined()
    expect(parse("ssh://")).toBeUndefined()
    expect(parse("  ")).toBeUndefined()
  })
})

describe("args", () => {
  test("includes batch mode, port, and extras before the destination", () => {
    expect(args({ destination: "dev@dev-box", port: 2222 }, ["-tt"])).toEqual([
      "-o",
      "BatchMode=yes",
      "-p",
      "2222",
      "-tt",
      "dev@dev-box",
    ])
  })

  test("omits the port flag when unset", () => {
    expect(args({ destination: "dev-box" })).toEqual(["-o", "BatchMode=yes", "dev-box"])
  })
})

describe("endpoint", () => {
  test("extracts the port from the serve banner", () => {
    expect(endpoint("opencode server listening on http://127.0.0.1:39241\n")).toBe(39241)
  })

  test("handles tty line endings and prefixed output", () => {
    expect(endpoint("Warning: unsecured\r\nopencode server listening on http://127.0.0.1:4096\r\n")).toBe(4096)
  })

  test("returns undefined when no banner is present", () => {
    expect(endpoint("bash: bolt: command not found")).toBeUndefined()
  })
})

describe("explain", () => {
  test("points at a missing bolt install", () => {
    expect(explain("dev-box", "bash: bolt: command not found")).toContain("requires bolt preinstalled")
  })

  test("points at non-interactive auth failures", () => {
    expect(explain("dev-box", "Permission denied (publickey).")).toContain("key-based auth")
  })

  test("falls back to the raw output", () => {
    expect(explain("dev-box", "something odd")).toBe("Failed to start bolt serve on dev-box: something odd")
  })
})
