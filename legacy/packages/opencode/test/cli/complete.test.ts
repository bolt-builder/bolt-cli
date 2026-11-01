import { describe, expect, test } from "bun:test"
import { Complete } from "../../src/cli/complete"

describe("match", () => {
  test("returns everything when nothing has been typed", () => {
    expect(Complete.match(["a", "b"], "")).toEqual(["a", "b"])
  })

  test("filters candidates by prefix", () => {
    expect(Complete.match(["anthropic/claude", "openai/gpt-5"], "openai")).toEqual(["openai/gpt-5"])
  })
})

describe("dynamic", () => {
  test("returns undefined for flags without dynamic values", () => {
    expect(Complete.dynamic("--title", "")).resolves.toBeUndefined()
  })

  test("completes agent names after --agent", async () => {
    const values = await Complete.dynamic("--agent", "code")
    expect(values).toContain("code")
    expect(values).toContain("code-review")
  })
})

describe("fish", () => {
  test("routes through the yargs completion callback", () => {
    expect(Complete.fish()).toContain("--get-yargs-completions")
    expect(Complete.fish()).toContain("complete -c bolt")
  })
})
