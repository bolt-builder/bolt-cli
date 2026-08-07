import { describe, expect, test } from "bun:test"
import { pick, table } from "../../src/cli/cmd/worktree"

const ROWS = [
  { name: "alpha", directory: "/data/worktree/p1/alpha", branch: "opencode/alpha" },
  { name: "beta", directory: "/data/worktree/p1/beta" },
  { name: "gamma", directory: "/data/worktree/p1/gamma", branch: "opencode/gamma" },
]

describe("table", () => {
  test("aligns names and marks detached worktrees", () => {
    const lines = table(ROWS)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe("alpha  opencode/alpha  /data/worktree/p1/alpha")
    expect(lines[1]).toContain("(detached)")
  })

  test("handles an empty list", () => {
    expect(table([])).toEqual([])
  })
})

describe("pick", () => {
  test("matches by name", () => {
    expect(pick(ROWS, "beta")?.directory).toBe("/data/worktree/p1/beta")
  })

  test("matches by branch", () => {
    expect(pick(ROWS, "opencode/gamma")?.name).toBe("gamma")
  })

  test("matches by directory", () => {
    expect(pick(ROWS, "/data/worktree/p1/alpha")?.name).toBe("alpha")
  })

  test("returns undefined for a miss", () => {
    expect(pick(ROWS, "delta")).toBeUndefined()
  })

  test("returns undefined when the key is ambiguous", () => {
    const rows = [...ROWS, { name: "opencode/gamma", directory: "/elsewhere" }]
    expect(pick(rows, "opencode/gamma")).toBeUndefined()
  })
})
