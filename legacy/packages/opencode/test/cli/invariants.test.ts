import { describe, expect, test } from "bun:test"
import { document, extract, parse } from "../../src/cli/cmd/invariants"

describe("extract", () => {
  test("parses dash bullets", () => {
    const text = "Here are the invariants:\n- parse() never throws\n- exit code is 0 on success"
    expect(extract(text)).toEqual(["parse() never throws", "exit code is 0 on success"])
  })

  test("parses star bullets and numbered lists", () => {
    const text = "* stays sorted\n1. no duplicates\n2) preserves order"
    expect(extract(text)).toEqual(["stays sorted", "no duplicates", "preserves order"])
  })

  test("ignores prose and blank lines", () => {
    const text = "I inspected the file.\n\n- the cache key includes the path\n\nThat is all."
    expect(extract(text)).toEqual(["the cache key includes the path"])
  })

  test("trims whitespace around invariants", () => {
    expect(extract("  -   spaced out  ")).toEqual(["spaced out"])
  })

  test("returns empty for text without bullets", () => {
    expect(extract("No list here.")).toEqual([])
  })
})

describe("document and parse", () => {
  test("round-trips files and invariants", () => {
    const rendered = document(["src/a.ts", "src/b.ts"], ["never throws", "returns sorted output"])
    const roundtrip = parse(rendered)
    expect(roundtrip.files).toEqual(["src/a.ts", "src/b.ts"])
    expect(roundtrip.invariants).toEqual(["never throws", "returns sorted output"])
  })

  test("parses a document with no files header", () => {
    const roundtrip = parse("- lonely invariant\n")
    expect(roundtrip.files).toEqual([])
    expect(roundtrip.invariants).toEqual(["lonely invariant"])
  })

  test("renders a markdown document", () => {
    expect(document(["src/a.ts"], ["holds"])).toBe("# Invariants\n\nFiles: src/a.ts\n\n- holds\n")
  })
})
