import { describe, expect, test } from "bun:test"
import { conflicts, name, ported, slug } from "../../src/cli/cmd/port"

describe("ported", () => {
  test("reports absent when the commit is not on the target", () => {
    expect(ported("+ 1234567890abcdef1234567890abcdef12345678")).toBe("absent")
  })

  test("reports present when an equivalent change exists", () => {
    expect(ported("- 1234567890abcdef1234567890abcdef12345678")).toBe("present")
  })

  test("reports present for empty output", () => {
    expect(ported("")).toBe("present")
    expect(ported("\n")).toBe("present")
  })

  test("rejects unexpected output", () => {
    expect(ported("fatal: unknown commit")).toBeUndefined()
  })
})

describe("slug", () => {
  test("strips origin/ and non-alphanumerics", () => {
    expect(slug("origin/release/1.2")).toBe("release-1-2")
  })

  test("trims leading and trailing separators", () => {
    expect(slug("-release-")).toBe("release")
  })
})

describe("name", () => {
  test("combines the short sha and target slug", () => {
    expect(name("1234567890abcdef", "release/1.2")).toBe("port-1234567-release-1-2")
  })
})

describe("conflicts", () => {
  test("picks out unmerged paths", () => {
    expect(conflicts("UU src/a.ts\n M src/b.ts\nAA src/c.ts")).toEqual(["src/a.ts", "src/c.ts"])
  })

  test("returns nothing for a clean status", () => {
    expect(conflicts(" M src/a.ts")).toEqual([])
  })
})
