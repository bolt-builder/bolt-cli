import { describe, expect, test } from "bun:test"
import { check, plan, todo } from "../../src/cli/cmd/rebase"

const RESPONSE = [
  "Here is the plan.",
  "",
  "```",
  "pick aaaaaaa :: solid standalone change",
  'reword bbbbbbb "feat(core): add retry budget" :: subject was vague',
  "fixup ccccccc :: fixes a typo introduced by the previous commit",
  "drop ddddddd :: reverted experiment, nothing depends on it",
  "```",
].join("\n")

describe("plan", () => {
  test("parses actions, shas, subjects, and notes", () => {
    const steps = plan(RESPONSE)
    expect(steps).toHaveLength(4)
    expect(steps?.[0]).toEqual({ action: "pick", sha: "aaaaaaa", note: "solid standalone change" })
    expect(steps?.[1].action).toBe("reword")
    expect(steps?.[1].subject).toBe("feat(core): add retry budget")
    expect(steps?.[2].action).toBe("fixup")
    expect(steps?.[3].action).toBe("drop")
  })

  test("uses the last fenced block", () => {
    const text = "```\nnot a plan\n```\nActual plan:\n```\npick aaaaaaa :: fine\n```"
    expect(plan(text)).toHaveLength(1)
  })

  test("rejects a response without a fenced block", () => {
    expect(plan("pick aaaaaaa :: fine")).toBeUndefined()
  })

  test("rejects unknown actions", () => {
    expect(plan("```\nmerge aaaaaaa :: nope\n```")).toBeUndefined()
  })

  test("rejects malformed lines", () => {
    expect(plan("```\npick aaaaaaa\n```")).toBeUndefined()
    expect(plan("```\npick nothex :: fine\n```")).toBeUndefined()
  })

  test("unescapes quoted subjects", () => {
    const steps = plan('```\nreword aaaaaaa "say \\"hi\\"" :: quoting\n```')
    expect(steps?.[0].subject).toBe('say "hi"')
  })

  test("rejects an empty block", () => {
    expect(plan("```\n\n```")).toBeUndefined()
  })
})

describe("check", () => {
  const shas = ["aaaaaaa1111", "bbbbbbb2222"]

  test("accepts a complete plan", () => {
    const steps = plan('```\npick aaaaaaa :: ok\nreword bbbbbbb "better" :: ok\n```')
    expect(check(steps ?? [], shas)).toBeUndefined()
  })

  test("flags missing commits", () => {
    const steps = plan("```\npick aaaaaaa :: ok\n```")
    expect(check(steps ?? [], shas)).toContain("missing")
  })

  test("flags unknown commits", () => {
    const steps = plan("```\npick aaaaaaa :: ok\npick bbbbbbb :: ok\npick fffffff :: ok\n```")
    expect(check(steps ?? [], shas)).toContain("unknown")
  })

  test("flags duplicated commits", () => {
    const steps = plan("```\npick aaaaaaa :: ok\npick aaaaaaa :: again\npick bbbbbbb :: ok\n```")
    expect(check(steps ?? [], shas)).toContain("more than once")
  })

  test("flags a leading squash", () => {
    const steps = plan("```\ndrop aaaaaaa :: dead\nsquash bbbbbbb :: nope\n```")
    expect(check(steps ?? [], shas)).toContain("cannot be a squash")
  })

  test("flags a reword without a subject", () => {
    expect(check([{ action: "reword", sha: "aaaaaaa", note: "x" }], ["aaaaaaa"])).toContain("missing a new subject")
  })
})

describe("todo", () => {
  test("serializes plain actions", () => {
    const steps = plan("```\npick aaaaaaa :: ok\nfixup bbbbbbb :: fold\ndrop ccccccc :: dead\n```")
    expect(todo(steps ?? [])).toBe("pick aaaaaaa\nfixup bbbbbbb\ndrop ccccccc\n")
  })

  test("turns rewords into pick plus exec amend", () => {
    const steps = plan('```\nreword aaaaaaa "new subject" :: clearer\n```')
    expect(todo(steps ?? [])).toBe('pick aaaaaaa\nexec git commit --amend -m "new subject"\n')
  })

  test("escapes quotes in reworded subjects", () => {
    const steps = plan('```\nreword aaaaaaa "say \\"hi\\"" :: quoting\n```')
    expect(todo(steps ?? [])).toBe('pick aaaaaaa\nexec git commit --amend -m "say \\"hi\\""\n')
  })
})
