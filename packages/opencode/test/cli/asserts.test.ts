import { describe, expect, test } from "bun:test"
import { findings, mine } from "../../src/cli/cmd/asserts"

describe("mine", () => {
  test("parses test blocks with assertion counts", () => {
    const source = [
      'test("adds", () => {',
      "  expect(add(1, 2)).toBe(3)",
      "  expect(add(2, 2)).toBe(4)",
      "})",
      'test("logs", () => {',
      "  run()",
      "})",
    ].join("\n")
    expect(mine(source)).toEqual([
      { name: "adds", line: 1, expects: 2, weak: 0 },
      { name: "logs", line: 5, expects: 0, weak: 0 },
    ])
  })

  test("supports it blocks and test modifiers", () => {
    const source = 'it("works", () => { expect(1).toBe(1) })\ntest.skip("later", () => {})'
    expect(mine(source).map((block) => block.name)).toEqual(["works", "later"])
  })

  test("counts assertions on one-line tests", () => {
    const blocks = mine('test("inline", () => expect(f()).toBe(2))')
    expect(blocks[0].expects).toBe(1)
  })

  test("counts weak assertions", () => {
    const source = ['test("vague", () => {', "  expect(result).toBeTruthy()", "  expect(other).toBeDefined()", "})"].join(
      "\n",
    )
    expect(mine(source)).toEqual([{ name: "vague", line: 1, expects: 2, weak: 2 }])
  })

  test("counts node assert calls", () => {
    const source = 'test("legacy", () => {\n  assert.equal(a, b)\n  assert(ok)\n})'
    expect(mine(source)[0].expects).toBe(2)
  })

  test("ignores assertions outside any test block", () => {
    expect(mine("expect(setup()).toBe(true)")).toEqual([])
  })

  test("does not treat attest or latest as test starts", () => {
    expect(mine('const latest = attest("nope")')).toEqual([])
  })
})

describe("findings", () => {
  test("flags tests without assertions", () => {
    const flagged = findings([{ name: "logs", line: 5, expects: 0, weak: 0 }])
    expect(flagged).toEqual([{ kind: "none", block: { name: "logs", line: 5, expects: 0, weak: 0 } }])
  })

  test("flags tests with only weak assertions", () => {
    const flagged = findings([{ name: "vague", line: 1, expects: 2, weak: 2 }])
    expect(flagged[0].kind).toBe("weak")
  })

  test("passes tests with at least one strong assertion", () => {
    expect(findings([{ name: "solid", line: 1, expects: 2, weak: 1 }])).toEqual([])
  })
})
