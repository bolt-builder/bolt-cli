import { describe, expect, test } from "bun:test"
import { busiestHours, topProjects } from "../../src/cli/cmd/stats"

describe("stats topProjects", () => {
  test("aggregates sessions and cost per project", () => {
    const result = topProjects([
      { projectID: "a", directory: "/repo/a", cost: 1 },
      { projectID: "a", directory: "/repo/a", cost: 2.5 },
      { projectID: "b", directory: "/repo/b", cost: 4 },
    ])
    expect(result).toEqual([
      { label: "/repo/a", sessions: 2, cost: 3.5 },
      { label: "/repo/b", sessions: 1, cost: 4 },
    ])
  })

  test("treats missing cost as zero", () => {
    const result = topProjects([{ projectID: "a", directory: "/repo/a" }])
    expect(result[0].cost).toBe(0)
  })

  test("sorts by session count descending", () => {
    const result = topProjects([
      { projectID: "a", directory: "/repo/a" },
      { projectID: "b", directory: "/repo/b" },
      { projectID: "b", directory: "/repo/b" },
    ])
    expect(result.map((entry) => entry.label)).toEqual(["/repo/b", "/repo/a"])
  })

  test("returns empty for no sessions", () => {
    expect(topProjects([])).toEqual([])
  })
})

describe("stats busiestHours", () => {
  test("buckets times into 24 local hours", () => {
    const noon = new Date()
    noon.setHours(12, 30, 0, 0)
    const result = busiestHours([noon.getTime(), noon.getTime()])
    expect(result).toHaveLength(24)
    expect(result[12]).toBe(2)
    expect(result.reduce((a, b) => a + b, 0)).toBe(2)
  })

  test("returns all zeros for no sessions", () => {
    expect(busiestHours([])).toEqual(Array.from({ length: 24 }, () => 0))
  })
})
