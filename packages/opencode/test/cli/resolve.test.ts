import { describe, expect, test } from "bun:test"
import { hunks, merged, unmerged } from "../../src/cli/cmd/resolve"

const SIMPLE = [
  "const a = 1",
  "<<<<<<< HEAD",
  "const b = 2",
  "=======",
  "const b = 3",
  ">>>>>>> feature",
  "const c = 4",
].join("\n")

const DIFF3 = ["<<<<<<< ours", "left()", "||||||| base", "original()", "=======", "right()", ">>>>>>> theirs"].join(
  "\n",
)

describe("hunks", () => {
  test("parses a simple conflict", () => {
    const found = hunks(SIMPLE)
    expect(found).toHaveLength(1)
    expect(found[0].ours).toBe("const b = 2")
    expect(found[0].theirs).toBe("const b = 3")
    expect(found[0].ourl).toBe("HEAD")
    expect(found[0].theirl).toBe("feature")
    expect(found[0].base).toBeUndefined()
  })

  test("parses diff3-style base sections", () => {
    const found = hunks(DIFF3)
    expect(found).toHaveLength(1)
    expect(found[0].ours).toBe("left()")
    expect(found[0].base).toBe("original()")
    expect(found[0].theirs).toBe("right()")
  })

  test("parses several conflicts in one file", () => {
    const found = hunks(`${SIMPLE}\n${SIMPLE}`)
    expect(found).toHaveLength(2)
  })

  test("parses multi-line sides", () => {
    const found = hunks("<<<<<<< HEAD\na\nb\n=======\nc\nd\n>>>>>>> other")
    expect(found[0].ours).toBe("a\nb")
    expect(found[0].theirs).toBe("c\nd")
  })

  test("returns nothing for a clean file", () => {
    expect(hunks("const a = 1\nconst b = 2")).toHaveLength(0)
  })

  test("ignores an unterminated marker", () => {
    expect(hunks("<<<<<<< HEAD\nconst a = 1")).toHaveLength(0)
  })
})

describe("unmerged", () => {
  test("picks out unmerged paths", () => {
    const text = ["UU src/a.ts", "AA src/b.ts", " M src/c.ts", "?? notes.md", "DU src/d.ts"].join("\n")
    expect(unmerged(text)).toEqual(["src/a.ts", "src/b.ts", "src/d.ts"])
  })

  test("returns nothing for a clean status", () => {
    expect(unmerged(" M src/a.ts\n?? notes.md")).toEqual([])
    expect(unmerged("")).toEqual([])
  })
})

describe("merged", () => {
  test("extracts the last fenced block", () => {
    const text = "The sides are independent, so both survive.\n\n```ts\nconst b = 2\nconst d = 3\n```"
    expect(merged(text)).toBe("const b = 2\nconst d = 3\n")
  })

  test("prefers the final block when several appear", () => {
    const text = "First:\n```\nold\n```\nThen:\n```\nnew\n```"
    expect(merged(text)).toBe("new\n")
  })

  test("rejects content that still contains conflict markers", () => {
    expect(merged("```\n<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> z\n```")).toBeUndefined()
  })

  test("rejects an empty block", () => {
    expect(merged("```\n\n```")).toBeUndefined()
  })

  test("rejects a response without a fenced block", () => {
    expect(merged("I could not resolve this.")).toBeUndefined()
  })
})
