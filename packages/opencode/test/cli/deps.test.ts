import { describe, expect, test } from "bun:test"
import { behind, declared, markdown, report } from "../../src/cli/cmd/deps"

const NOW = Date.parse("2026-01-01T00:00:00Z")

describe("declared", () => {
  test("collects external dependencies with stripped ranges", () => {
    const deps = declared({
      "package.json": { name: "root", dependencies: { effect: "^3.12.0", zod: "~4.0.1" }, devDependencies: { vitest: ">=2.0.0" } },
    })
    expect(deps.get("effect")).toBe("3.12.0")
    expect(deps.get("zod")).toBe("4.0.1")
    expect(deps.get("vitest")).toBe("2.0.0")
  })

  test("excludes workspace packages and non-registry specifiers", () => {
    const deps = declared({
      "package.json": { name: "root", dependencies: { core: "*", linked: "workspace:*", effect: "^3.0.0" } },
      "packages/core/package.json": { name: "core" },
    })
    expect([...deps.keys()]).toEqual(["effect"])
  })
})

describe("behind", () => {
  test("classifies version distance", () => {
    expect(behind("1.2.3", "2.0.0")).toBe("major")
    expect(behind("1.2.3", "1.3.0")).toBe("minor")
    expect(behind("1.2.3", "1.2.4")).toBe("patch")
    expect(behind("1.2.3", "1.2.3")).toBe("current")
    expect(behind("1.2.3", "next")).toBe("unknown")
  })
})

describe("report", () => {
  const deps = new Map([
    ["vulnerable", "1.0.0"],
    ["deprecated", "1.0.0"],
    ["abandoned", "1.0.0"],
    ["outdated", "1.0.0"],
    ["healthy", "1.0.0"],
  ])
  const meta = new Map([
    ["vulnerable", { latest: "1.0.0", modified: "2025-12-01T00:00:00Z", deprecated: false }],
    ["deprecated", { latest: "1.0.0", modified: "2025-12-01T00:00:00Z", deprecated: true }],
    ["abandoned", { latest: "1.0.0", modified: "2022-01-01T00:00:00Z", deprecated: false }],
    ["outdated", { latest: "2.1.0", modified: "2025-12-01T00:00:00Z", deprecated: false }],
    ["healthy", { latest: "1.0.0", modified: "2025-12-01T00:00:00Z", deprecated: false }],
  ])
  const advisories = new Map([["vulnerable", [{ severity: "high", title: "prototype pollution" }]]])

  test("ranks vulnerable, deprecated, abandoned, then outdated and drops healthy", () => {
    const rows = report(deps, meta, advisories, NOW)
    expect(rows.map((row) => row.name)).toEqual(["vulnerable", "deprecated", "abandoned", "outdated"])
  })

  test("marks staleness in days and major distance", () => {
    const rows = report(deps, meta, advisories, NOW)
    const abandoned = rows.find((row) => row.name === "abandoned")
    expect(abandoned && abandoned.stale >= 730).toBe(true)
    expect(rows.find((row) => row.name === "outdated")?.behind).toBe("major")
  })

  test("skips packages without registry metadata", () => {
    expect(report(new Map([["ghost", "1.0.0"]]), new Map(), new Map(), NOW)).toEqual([])
  })
})

describe("markdown", () => {
  test("renders flags for each finding", () => {
    const rows = report(
      new Map([["risky", "1.0.0"]]),
      new Map([["risky", { latest: "2.0.0", modified: "2022-01-01T00:00:00Z", deprecated: true }]]),
      new Map([["risky", [{ severity: "critical", title: "rce" }]]]),
      NOW,
    )
    const text = markdown(rows, 10)
    expect(text).toContain("1 of 10 dependencies need attention; riskiest first.")
    expect(text).toContain("critical: rce")
    expect(text).toContain("deprecated")
    expect(text).toContain("no publish in")
    expect(text).toContain("| `risky` | 1.0.0 | 2.0.0 | major |")
  })

  test("reports a clean bill of health", () => {
    expect(markdown([], 12)).toContain("All 12 dependencies look healthy.")
  })
})
