import { describe, expect, test } from "bun:test"
import { label, line, parse, summary, suspect } from "../../src/cli/cmd/signature"

describe("label", () => {
  test("labels each verification code", () => {
    expect(label("G")).toBe("valid signature")
    expect(label("U")).toBe("valid signature, untrusted key")
    expect(label("B")).toBe("BAD signature")
    expect(label("E")).toContain("cannot be checked")
    expect(label("N")).toBe("unsigned")
    expect(label("")).toBe("unsigned")
  })
})

describe("suspect", () => {
  test("flags bad, revoked, and uncheckable signatures", () => {
    expect(suspect("B")).toBe(true)
    expect(suspect("R")).toBe(true)
    expect(suspect("E")).toBe(true)
    expect(suspect("G")).toBe(false)
    expect(suspect("N")).toBe(false)
  })
})

describe("parse", () => {
  test("parses log output with signer names", () => {
    const text = "abc1234\x00G\x00Ada Lovelace\ndef5678\x00N\x00"
    const found = parse(text)
    expect(found).toHaveLength(2)
    expect(found[0]).toEqual({ sha: "abc1234", code: "G", signer: "Ada Lovelace" })
    expect(found[1].code).toBe("N")
  })

  test("treats an empty code as unsigned", () => {
    expect(parse("abc1234\x00\x00")[0].code).toBe("N")
  })

  test("skips malformed lines", () => {
    expect(parse("fatal: bad revision\nnot-a-sha\x00G\x00x")).toEqual([])
  })
})

describe("summary", () => {
  test("aggregates counts and details problem commits", () => {
    const entries = parse(["abc1234\x00G\x00Ada", "def5678\x00N\x00", "0000abc\x00B\x00Mallory"].join("\n"))
    const lines = summary(entries)
    expect(lines[0]).toBe("Signatures: 1 signed, 1 unsigned, 1 needing attention of 3 commits")
    expect(lines[1]).toBe("  0000abc BAD signature (Mallory)")
  })

  test("omits the attention count when everything is clean", () => {
    const lines = summary(parse("abc1234\x00G\x00Ada"))
    expect(lines).toEqual(["Signatures: 1 signed, 0 unsigned of 1 commits"])
  })

  test("returns nothing for no commits", () => {
    expect(summary([])).toEqual([])
  })
})

describe("line", () => {
  test("formats a single commit's signature status", () => {
    expect(line({ sha: "abc1234", code: "G", signer: "Ada" })).toBe("Signature: valid signature (Ada)")
    expect(line({ sha: "abc1234", code: "N", signer: "" })).toBe("Signature: unsigned")
  })
})
