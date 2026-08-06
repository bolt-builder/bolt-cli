import { describe, expect, test } from "bun:test"
import { substitute } from "../../src/tool/slashcommand"

describe("substitute", () => {
  test("replaces $ARGUMENTS with the full arguments string", () => {
    expect(substitute("Review $ARGUMENTS carefully", "the auth module")).toBe("Review the auth module carefully")
  })

  test("replaces numbered placeholders positionally", () => {
    expect(substitute("Compare $1 with $2", "left right")).toBe("Compare left with right")
  })

  test("keeps quoted arguments together", () => {
    expect(substitute("Rename $1 to $2", '"old name" fresh')).toBe("Rename old name to fresh")
  })

  test("missing arguments become empty strings", () => {
    expect(substitute("Compare $1 with $2", "left")).toBe("Compare left with ")
  })

  test("missing arguments with no input", () => {
    expect(substitute("Run $1", "")).toBe("Run ")
  })

  test("extra arguments flow into the last numbered placeholder", () => {
    expect(substitute("Deploy $1 to $2", "api staging with flags")).toBe("Deploy api to staging with flags")
  })

  test("extra arguments beyond $ARGUMENTS are not duplicated", () => {
    expect(substitute("Do $ARGUMENTS", "a b c")).toBe("Do a b c")
  })

  test("appends arguments when the template has no placeholders", () => {
    expect(substitute("Run the standard review", "focus on tests")).toBe("Run the standard review\n\nfocus on tests")
  })

  test("does not append when there are no arguments", () => {
    expect(substitute("Run the standard review", "")).toBe("Run the standard review")
  })

  test("repeated numbered placeholders each substitute", () => {
    expect(substitute("$1 and $1 again", "echo")).toBe("echo and echo again")
  })

  test("mixed numbered and $ARGUMENTS placeholders", () => {
    expect(substitute("First $1, all: $ARGUMENTS", "one two")).toBe("First one two, all: one two")
  })
})
