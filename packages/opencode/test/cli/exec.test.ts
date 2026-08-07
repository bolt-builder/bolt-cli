import { describe, expect, test } from "bun:test"
import { outcome, prompt, steps } from "../../src/cli/cmd/exec"

describe("steps", () => {
  test("splits on level-2 headings and ignores the preamble", () => {
    const parsed = steps(
      ["# Playbook", "", "Some intro text.", "", "## Build", "Run the build.", "", "## Test", "Run the tests."].join(
        "\n",
      ),
    )
    expect(parsed).toEqual([
      { title: "Build", body: "Run the build." },
      { title: "Test", body: "Run the tests." },
    ])
  })

  test("keeps multi-line bodies including nested lists", () => {
    const parsed = steps(["## Deploy", "First line.", "- check a", "- check b"].join("\n"))
    expect(parsed).toEqual([{ title: "Deploy", body: "First line.\n- check a\n- check b" }])
  })

  test("falls back to top-level list items when there are no headings", () => {
    const parsed = steps(["Intro paragraph.", "", "1. install deps", "2. run lint", "- run tests"].join("\n"))
    expect(parsed.map((step) => step.title)).toEqual(["install deps", "run lint", "run tests"])
  })

  test("strips task checkbox markers", () => {
    const parsed = steps("- [ ] first\n- [x] second")
    expect(parsed.map((step) => step.title)).toEqual(["first", "second"])
  })

  test("attaches indented continuation lines to the current list step", () => {
    const parsed = steps(["- first", "  more detail", "- second"].join("\n"))
    expect(parsed[0]).toEqual({ title: "first", body: "more detail" })
    expect(parsed[1].title).toBe("second")
  })

  test("ignores headings and list markers inside fenced code blocks", () => {
    const parsed = steps(["## Real", "```md", "## Fake", "- fake item", "```", "after fence"].join("\n"))
    expect(parsed).toHaveLength(1)
    expect(parsed[0].title).toBe("Real")
    expect(parsed[0].body).toContain("## Fake")
    expect(parsed[0].body).toContain("after fence")
  })

  test("returns no steps for structureless text", () => {
    expect(steps("just a paragraph\nanother line")).toEqual([])
  })
})

describe("outcome", () => {
  test("parses done and failed markers case-insensitively", () => {
    expect(outcome("all good\n\nStep: DONE")).toBe("done")
    expect(outcome("could not apply\n\nstep: failed")).toBe("failed")
  })

  test("uses the last marker when several appear", () => {
    expect(outcome('End with "Step: DONE".\n\nStep: FAILED')).toBe("failed")
  })

  test("returns undefined without a marker", () => {
    expect(outcome("looks fine")).toBeUndefined()
  })
})

describe("prompt", () => {
  test("includes position, title, and body", () => {
    const text = prompt({ title: "Build", body: "Run the build." }, 1, 3)
    expect(text).toContain("step 1 of 3")
    expect(text).toContain("Step 1: Build")
    expect(text).toContain("Run the build.")
    expect(text).toContain('"Step: DONE"')
  })

  test("omits the body block when empty", () => {
    const text = prompt({ title: "Build", body: "" }, 2, 2)
    expect(text.endsWith("Step 2: Build")).toBe(true)
  })
})
