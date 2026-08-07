import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { contract, markdown, violations, within } from "../../src/cli/cmd/drift"

const EDGE = { from: "src/cli", to: "src/session", file: "src/cli/run.ts", target: "src/session/core.ts" }

describe("contract", () => {
  test("decodes rules and defaults depth to 2", () => {
    const decoded = contract({ rules: [{ from: "src/util", allow: [] }] })
    expect(Option.isSome(decoded)).toBe(true)
    if (Option.isSome(decoded)) {
      expect(decoded.value.depth).toBe(2)
      expect(decoded.value.rules[0].from).toBe("src/util")
    }
  })

  test("rejects malformed contracts", () => {
    expect(Option.isNone(contract({ rules: [{ allow: [] }] }))).toBe(true)
    expect(Option.isNone(contract("nope"))).toBe(true)
  })
})

describe("within", () => {
  test("matches exact buckets and subdirectories only", () => {
    expect(within("src/cli", "src/cli")).toBe(true)
    expect(within("src/cli/cmd", "src/cli")).toBe(true)
    expect(within("src/climate", "src/cli")).toBe(false)
  })
})

describe("violations", () => {
  test("allow lists permit only listed targets and self", () => {
    const rules = [{ from: "src/cli", allow: ["src/util"] }]
    expect(violations([EDGE], rules).map((violation) => violation.rule)).toEqual(["src/cli"])
    expect(violations([{ ...EDGE, to: "src/util" }], rules)).toEqual([])
    expect(violations([{ ...EDGE, to: "src/cli/cmd" }], rules)).toEqual([])
  })

  test("deny lists forbid listed targets and permit the rest", () => {
    const rules = [{ from: "src/util", deny: ["src/cli"] }]
    expect(violations([{ ...EDGE, from: "src/util", to: "src/cli" }], rules).length).toBe(1)
    expect(violations([{ ...EDGE, from: "src/util", to: "src/session" }], rules)).toEqual([])
  })

  test("sources without a covering rule are unconstrained", () => {
    expect(violations([EDGE], [{ from: "src/tool", allow: [] }])).toEqual([])
  })

  test("empty allow list freezes a directory to itself", () => {
    const rules = [{ from: "src/util", allow: [] }]
    expect(violations([{ ...EDGE, from: "src/util" }], rules).length).toBe(1)
    expect(violations([{ ...EDGE, from: "src/util", to: "src/util/deep" }], rules)).toEqual([])
  })

  test("the first covering rule wins", () => {
    const rules = [
      { from: "src/cli", allow: ["src/session"] },
      { from: "src/cli", allow: [] },
    ]
    expect(violations([EDGE], rules)).toEqual([])
  })
})

describe("markdown", () => {
  test("groups violations by directory pair with evidence", () => {
    const found = violations(
      [EDGE, { ...EDGE, file: "src/cli/other.ts" }, { ...EDGE, to: "src/db", target: "src/db/schema.ts" }],
      [{ from: "src/cli", allow: [] }],
    )
    const text = markdown(found, 3)
    expect(text).toContain("3 imports violate the declared contract.")
    expect(text).toContain("## `src/cli -> src/session` (2 imports, rule `src/cli`)")
    expect(text).toContain("- `src/cli/run.ts` imports `src/session/core.ts`")
    expect(text.indexOf("src/cli -> src/session")).toBeLessThan(text.indexOf("src/cli -> src/db"))
  })

  test("reports a clean pass with the edge count", () => {
    expect(markdown([], 42)).toContain("No drift: 42 import edges satisfy the contract.")
  })
})
