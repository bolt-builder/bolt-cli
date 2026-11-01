import { describe, expect, test } from "bun:test"
import { saved } from "../src/commands/handlers/learn"

describe("learn saved outcomes", () => {
  test("counts only successful memory-save outcomes and deduplicates sources", () => {
    expect(
      saved([
        { name: "memory_recall", metadata: { sources: ["ignored.md"] } },
        { name: "memory_save", metadata: { sources: ["project.md"] } },
        { name: "memory_save", metadata: { sources: ["project.md", "environment.md"] } },
      ]),
    ).toEqual({ count: 2, sources: ["project.md", "environment.md"] })
  })
  test("accepts missing metadata and rejects malformed source values", () => {
    expect(
      saved([
        { name: "memory_save" },
        { name: "memory_save", metadata: { sources: "project.md" } },
        { name: "memory_save", metadata: { sources: [1, "corrections.md"] } },
      ]),
    ).toEqual({ count: 3, sources: ["corrections.md"] })
    expect(saved([])).toEqual({ count: 0, sources: [] })
  })
})
