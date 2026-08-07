import { describe, expect, test } from "bun:test"
import { render } from "../../src/cli/cmd/doctor"

describe("doctor render", () => {
  test("marks passing checks without a fix line", () => {
    const output = render([{ name: "binary", ok: true, detail: "1.0.0 via curl" }])
    expect(output).toContain("✓")
    expect(output).toContain("binary: 1.0.0 via curl")
    expect(output).not.toContain("fix:")
  })

  test("marks failing checks and prints the fix", () => {
    const output = render([{ name: "gateway", ok: false, detail: "unreachable", fix: "check your network" }])
    expect(output).toContain("✗")
    expect(output).toContain("gateway: unreachable")
    expect(output).toContain("fix: check your network")
  })

  test("omits the fix line when a failing check has none", () => {
    const output = render([{ name: "config", ok: false, detail: "broken" }])
    expect(output).toContain("✗")
    expect(output).not.toContain("fix:")
  })

  test("renders one line per passing check", () => {
    const output = render([
      { name: "a", ok: true, detail: "x" },
      { name: "b", ok: true, detail: "y" },
    ])
    expect(output.split("\n")).toHaveLength(2)
  })
})
