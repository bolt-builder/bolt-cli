import { describe, expect, test } from "bun:test"
import os from "os"
import { Sandbox } from "../src/sandbox"

describe("sandbox", () => {
  test("enabled reads the session metadata flag strictly", () => {
    expect(Sandbox.enabled({ sandbox: true })).toBe(true)
    expect(Sandbox.enabled({ sandbox: "true" })).toBe(false)
    expect(Sandbox.enabled({ sandbox: false })).toBe(false)
    expect(Sandbox.enabled({})).toBe(false)
    expect(Sandbox.enabled(undefined)).toBe(false)
    expect(Sandbox.enabled(null)).toBe(false)
  })

  test("writable dedupes roots, adds temp locations, and drops empty or root entries", () => {
    const dirs = Sandbox.writable(["/repo", "/repo", "", "/"])
    expect(dirs).toContain("/repo")
    expect(dirs).toContain("/tmp")
    expect(dirs).toContain(os.tmpdir())
    expect(dirs).not.toContain("")
    expect(dirs).not.toContain("/")
    expect(new Set(dirs).size).toBe(dirs.length)
  })

  test("linux argv rebinds writable roots over a read-only root and runs the shell", () => {
    const wrapped = Sandbox.linux({ command: "bun test", shell: "/bin/sh", writable: ["/repo", "/tmp"] }, "/usr/bin/bwrap")
    expect(wrapped.exe).toBe("/usr/bin/bwrap")
    expect(wrapped.args.slice(0, 3)).toEqual(["--ro-bind", "/", "/"])
    expect(wrapped.args).toContain("--die-with-parent")
    expect(wrapped.args.join(" ")).toContain("--bind-try /repo /repo")
    expect(wrapped.args.join(" ")).toContain("--bind-try /tmp /tmp")
    expect(wrapped.args.slice(-3)).toEqual(["/bin/sh", "-c", "bun test"])
  })

  test("darwin profile denies writes outside the writable roots and escapes quotes", () => {
    const text = Sandbox.profile(['/repo/we"ird', "/tmp"])
    expect(text).toContain("(deny file-write*)")
    expect(text).toContain('(subpath "/repo/we\\"ird")')
    expect(text).toContain('(subpath "/tmp")')
    expect(text).toContain('(subpath "/dev")')

    const wrapped = Sandbox.darwin({ command: "bun test", shell: "/bin/zsh", writable: ["/repo"] }, "/usr/bin/sandbox-exec")
    expect(wrapped.args[0]).toBe("-p")
    expect(wrapped.args.slice(-3)).toEqual(["/bin/zsh", "-c", "bun test"])
  })
})
