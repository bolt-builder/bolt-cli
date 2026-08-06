import { describe, expect, test } from "bun:test"
import { saved } from "../../src/cli/cmd/learn"

describe("saved", () => {
  test("counts completed memory_save parts and collects sources", () => {
    const result = saved([
      { type: "text" },
      {
        type: "tool",
        tool: "memory_save",
        state: { status: "completed", metadata: { sources: ["project.md"] } },
      },
      {
        type: "tool",
        tool: "memory_save",
        state: { status: "completed", metadata: { sources: ["project.md", "environment.md"] } },
      },
    ])
    expect(result.count).toBe(2)
    expect(result.sources).toEqual(["project.md", "environment.md"])
  })

  test("ignores other tools, pending saves, and errored saves", () => {
    const result = saved([
      { type: "tool", tool: "memory_recall", state: { status: "completed", metadata: { sources: ["project.md"] } } },
      { type: "tool", tool: "memory_save", state: { status: "pending" } },
      { type: "tool", tool: "memory_save", state: { status: "error" } },
    ])
    expect(result.count).toBe(0)
    expect(result.sources).toEqual([])
  })

  test("tolerates missing or malformed sources metadata", () => {
    const result = saved([
      { type: "tool", tool: "memory_save", state: { status: "completed", metadata: {} } },
      { type: "tool", tool: "memory_save", state: { status: "completed", metadata: { sources: "project.md" } } },
      { type: "tool", tool: "memory_save", state: { status: "completed", metadata: { sources: [1, "corrections.md"] } } },
    ])
    expect(result.count).toBe(3)
    expect(result.sources).toEqual(["corrections.md"])
  })

  test("returns zero for an empty run", () => {
    expect(saved([])).toEqual({ count: 0, sources: [] })
  })
})
