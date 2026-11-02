import { describe, expect, test } from "bun:test"
import { mutate } from "../../src/cli/cmd/mutate"

describe("mutate", () => {
  test("swaps strict equality both ways", () => {
    const mutants = mutate("if (a === b) return a !== c")
    const descriptions = mutants.map((mutant) => mutant.description)
    expect(descriptions).toContain("=== -> !==")
    expect(descriptions).toContain("!== -> ===")
  })

  test("swaps logical operators", () => {
    const mutants = mutate("const ok = a && b\nconst other = a || b")
    expect(mutants.map((mutant) => mutant.description)).toEqual(["&& -> ||", "|| -> &&"])
    expect(mutants[0].line).toBe(1)
    expect(mutants[1].line).toBe(2)
  })

  test("leaves compound logical assignments alone", () => {
    expect(mutate("a &&= b\na ||= b")).toEqual([])
  })

  test("swaps boolean literals but not identifiers containing them", () => {
    const mutants = mutate("const flag = true\nconst untrue = falsey")
    expect(mutants).toHaveLength(1)
    expect(mutants[0].description).toBe("true -> false")
    expect(mutants[0].source).toContain("const flag = false")
  })

  test("mutates spaced binary arithmetic only", () => {
    const mutants = mutate("const sum = a + b\nconst next = i++")
    expect(mutants).toHaveLength(1)
    expect(mutants[0].description).toBe("+ -> -")
    expect(mutants[0].source).toContain("const sum = a - b")
  })

  test("swaps comparison bounds without touching arrows", () => {
    const mutants = mutate("const f = (x: number) => x >= 2 && x <= 9")
    const descriptions = mutants.map((mutant) => mutant.description)
    expect(descriptions).toContain(">= -> >")
    expect(descriptions).toContain("<= -> <")
    for (const mutant of mutants) {
      expect(mutant.source).toContain("=>")
    }
  })

  test("skips comment lines", () => {
    const mutants = mutate("// a === b in a comment\n * doc a && b\nconst real = a === b")
    expect(mutants).toHaveLength(1)
    expect(mutants[0].line).toBe(3)
  })

  test("produces one mutant per site with a single line changed", () => {
    const source = "const a = x === y\nconst b = x === z"
    const mutants = mutate(source)
    expect(mutants).toHaveLength(2)
    expect(mutants[0].source.split("\n")[1]).toBe("const b = x === z")
    expect(mutants[1].source.split("\n")[0]).toBe("const a = x === y")
  })

  test("returns no mutants when nothing is mutable", () => {
    expect(mutate("const name = 'value'")).toEqual([])
  })
})
