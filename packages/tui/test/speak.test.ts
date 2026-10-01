import { describe, expect, test } from "bun:test"
import { clean } from "../src/speak"

describe("speak clean", () => {
  test("keeps plain prose untouched", () => {
    expect(clean("The build finished.")).toBe("The build finished.")
  })

  test("replaces fenced code blocks with a spoken note", () => {
    expect(clean("Here it is:\n```ts\nconst x = 1\n```\nDone.")).toBe(
      "Here it is: code block omitted. Done.",
    )
  })

  test("unwraps inline code spans", () => {
    expect(clean("run `bun test` now")).toBe("run bun test now")
  })

  test("keeps link text but drops the URL", () => {
    expect(clean("see [the docs](https://example.com/a?b=1)")).toBe("see the docs")
  })

  test("drops image tags entirely", () => {
    expect(clean("![alt](https://example.com/i.png) ok")).toBe("ok")
  })

  test("replaces bare URLs with the word link", () => {
    expect(clean("go to https://example.com/page")).toBe("go to link")
  })

  test("strips heading, quote, and list markers per line", () => {
    expect(clean("## Title\n> quoted\n- item")).toBe("Title quoted item")
  })

  test("removes emphasis and table pipe characters", () => {
    expect(clean("**bold** and _italic_ ~strike~ a|b")).toBe("bold and italic strike a b")
  })

  test("collapses repeated whitespace into single spaces", () => {
    expect(clean("a\n\n  b\t\tc")).toBe("a b c")
  })

  test("trims leading and trailing whitespace", () => {
    expect(clean("   hello   ")).toBe("hello")
  })

  test("leaves an empty string empty", () => {
    expect(clean("```ts\nonly code\n```")).toBe("code block omitted.")
    expect(clean("   ")).toBe("")
  })
})
