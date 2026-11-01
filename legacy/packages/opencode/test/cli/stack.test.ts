import { describe, expect, test } from "bun:test"
import { commands, contiguous, layers } from "../../src/cli/cmd/stack"

const RESPONSE = [
  "Two reviewable layers.",
  "",
  "```",
  "branch: retry-core :: feat(core): add the retry budget",
  "- aaaaaaa",
  "- bbbbbbb",
  "branch: retry-cli :: feat(bolt): wire the retry budget into the CLI",
  "- ccccccc",
  "```",
].join("\n")

describe("layers", () => {
  test("parses branch names, titles, and ordered shas", () => {
    const plan = layers(RESPONSE)
    expect(plan).toHaveLength(2)
    expect(plan?.[0].name).toBe("retry-core")
    expect(plan?.[0].title).toBe("feat(core): add the retry budget")
    expect(plan?.[0].shas).toEqual(["aaaaaaa", "bbbbbbb"])
    expect(plan?.[1].shas).toEqual(["ccccccc"])
  })

  test("rejects invalid branch names", () => {
    expect(layers("```\nbranch: Retry_Core :: title\n- aaaaaaa\n```")).toBeUndefined()
  })

  test("rejects a layer without commits", () => {
    expect(layers("```\nbranch: retry-core :: title\n```")).toBeUndefined()
  })

  test("rejects shas before any layer", () => {
    expect(layers("```\n- aaaaaaa\nbranch: retry-core :: title\n```")).toBeUndefined()
  })

  test("rejects a response without a fenced block", () => {
    expect(layers("branch: retry-core :: title\n- aaaaaaa")).toBeUndefined()
  })
})

describe("contiguous", () => {
  const shas = ["aaaaaaa1", "bbbbbbb2", "ccccccc3"]
  const plan = layers(RESPONSE) ?? []

  test("accepts an ordered partition", () => {
    expect(contiguous(plan, shas)).toBeUndefined()
  })

  test("flags missing commits", () => {
    expect(contiguous(plan, [...shas, "ddddddd4"])).toContain("every commit exactly once")
  })

  test("flags reordered commits", () => {
    expect(contiguous(plan, ["bbbbbbb2", "aaaaaaa1", "ccccccc3"])).toContain("oldest first")
  })

  test("flags reused branch names", () => {
    const dup = [
      { name: "same", title: "a", shas: ["aaaaaaa"] },
      { name: "same", title: "b", shas: ["bbbbbbb", "ccccccc"] },
    ]
    expect(contiguous(dup, shas)).toContain("reuses branch names")
  })
})

describe("commands", () => {
  test("chains each pr onto the branch below it", () => {
    const plan = layers(RESPONSE) ?? []
    expect(commands(plan, "dev")).toEqual([
      'gh pr create --head retry-core --base dev --title "feat(core): add the retry budget"',
      'gh pr create --head retry-cli --base retry-core --title "feat(bolt): wire the retry budget into the CLI"',
    ])
  })
})
