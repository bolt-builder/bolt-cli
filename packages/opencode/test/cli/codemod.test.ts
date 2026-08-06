import { describe, expect, test } from "bun:test"
import { buildArgs, parsePreview, parseTransform, render } from "../../src/cli/cmd/codemod"

describe("parseTransform", () => {
  test("parses a fenced json transform", () => {
    const text = [
      "Here is the transform:",
      "```json",
      '{"pattern": "console.log($$$ARGS)", "rewrite": "logger.info($$$ARGS)", "lang": "typescript"}',
      "```",
    ].join("\n")
    expect(parseTransform(text)).toEqual({
      pattern: "console.log($$$ARGS)",
      rewrite: "logger.info($$$ARGS)",
      lang: "typescript",
    })
  })

  test("uses the last fenced block when several appear", () => {
    const text = [
      "```json",
      '{"pattern": "a", "rewrite": "b", "lang": "ts"}',
      "```",
      "Actually, better:",
      "```json",
      '{"pattern": "x($A)", "rewrite": "y($A)", "lang": "tsx"}',
      "```",
    ].join("\n")
    expect(parseTransform(text)).toEqual({ pattern: "x($A)", rewrite: "y($A)", lang: "tsx" })
  })

  test("accepts a bare fence and a missing lang", () => {
    const text = "```\n" + '{"pattern": "a", "rewrite": ""}' + "\n```"
    expect(parseTransform(text)).toEqual({ pattern: "a", rewrite: "", lang: undefined })
  })

  test("rejects responses without a usable transform", () => {
    expect(parseTransform("no fence here")).toBeUndefined()
    expect(parseTransform("```json\nnot json\n```")).toBeUndefined()
    expect(parseTransform("```json\n[1, 2]\n```")).toBeUndefined()
    expect(parseTransform('```json\n{"pattern": 5, "rewrite": "x"}\n```')).toBeUndefined()
    expect(parseTransform('```json\n{"rewrite": "x"}\n```')).toBeUndefined()
    expect(parseTransform('```json\n{"pattern": "", "rewrite": "x"}\n```')).toBeUndefined()
  })
})

describe("buildArgs", () => {
  test("builds a streamed-json preview invocation by default", () => {
    expect(buildArgs({ pattern: "a($B)", rewrite: "c($B)", lang: "typescript" })).toEqual([
      "run",
      "--pattern",
      "a($B)",
      "--rewrite",
      "c($B)",
      "--lang",
      "typescript",
      "--json=stream",
    ])
  })

  test("omits lang when not given", () => {
    expect(buildArgs({ pattern: "a", rewrite: "b" })).toEqual(["run", "--pattern", "a", "--rewrite", "b", "--json=stream"])
  })

  test("switches to --update-all when applying", () => {
    expect(buildArgs({ pattern: "a", rewrite: "b", apply: true })).toEqual([
      "run",
      "--pattern",
      "a",
      "--rewrite",
      "b",
      "--update-all",
    ])
  })

  test("appends explicit paths", () => {
    expect(buildArgs({ pattern: "a", rewrite: "b", paths: ["src", "test"] })).toEqual([
      "run",
      "--pattern",
      "a",
      "--rewrite",
      "b",
      "--json=stream",
      "src",
      "test",
    ])
  })
})

describe("parsePreview", () => {
  test("parses one match per stream line", () => {
    const output = [
      '{"file": "src/a.ts", "text": "console.log(x)", "replacement": "logger.info(x)", "range": {"start": {"line": 2, "column": 0}}}',
      '{"file": "src/b.ts", "text": "console.log(y)", "replacement": "logger.info(y)", "range": {"start": {"line": 9, "column": 4}}}',
    ].join("\n")
    expect(parsePreview(output)).toEqual([
      { file: "src/a.ts", line: 3, before: "console.log(x)", after: "logger.info(x)" },
      { file: "src/b.ts", line: 10, before: "console.log(y)", after: "logger.info(y)" },
    ])
  })

  test("skips blank and malformed lines", () => {
    const output = ['not json', "", '{"file": "src/a.ts", "text": "x()", "replacement": "y()"}'].join("\n")
    expect(parsePreview(output)).toEqual([{ file: "src/a.ts", line: undefined, before: "x()", after: "y()" }])
  })

  test("handles empty output", () => {
    expect(parsePreview("")).toEqual([])
    expect(parsePreview("\n\n")).toEqual([])
  })
})

describe("render", () => {
  test("groups matches by file with diff-style lines", () => {
    const matches = [
      { file: "src/a.ts", line: 3, before: "console.log(x)", after: "logger.info(x)" },
      { file: "src/a.ts", line: 8, before: "console.log(z)", after: "logger.info(z)" },
      { file: "src/b.ts", line: 1, before: "console.log(y)", after: "logger.info(y)" },
    ]
    expect(render(matches)).toBe(
      [
        "src/a.ts",
        "  @ line 3",
        "  - console.log(x)",
        "  + logger.info(x)",
        "  @ line 8",
        "  - console.log(z)",
        "  + logger.info(z)",
        "",
        "src/b.ts",
        "  @ line 1",
        "  - console.log(y)",
        "  + logger.info(y)",
      ].join("\n"),
    )
  })

  test("renders multiline rewrites line by line", () => {
    const matches = [{ file: "a.ts", line: 1, before: "foo(\n  1,\n)", after: "bar(\n  1,\n)" }]
    expect(render(matches)).toBe(
      ["a.ts", "  @ line 1", "  - foo(", "  -   1,", "  - )", "  + bar(", "  +   1,", "  + )"].join("\n"),
    )
  })
})
