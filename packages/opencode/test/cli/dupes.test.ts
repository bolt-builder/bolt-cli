import { describe, expect, test } from "bun:test"
import { clusters, markdown, normalize } from "../../src/cli/cmd/dupes"

const BLOCK = [
  "const first = load(input)",
  "if (!first) return fallback",
  "const second = transform(first)",
  "if (!second) return fallback",
  "const third = persist(second)",
  "if (!third) return fallback",
  "return finalize(third)",
].join("\n")

describe("normalize", () => {
  test("strips comments and collapses whitespace", () => {
    const rows = normalize(["// leading comment", "const  a =   1", "/* block", "inside", "*/ const b = 2", ""].join("\n"))
    expect(rows).toEqual([
      { line: 2, text: "const a = N" },
      { line: 5, text: "const b = N" },
    ])
  })

  test("replaces string and numeric literals with placeholders", () => {
    const rows = normalize('const greeting = "hello world" + 42')
    expect(rows).toEqual([{ line: 1, text: "const greeting = S + N" }])
  })

  test("drops blank rows and lone braces but keeps line numbers", () => {
    const rows = normalize(["function foo() {", "}", "", "return 1", "{"].join("\n"))
    expect(rows).toEqual([
      { line: 1, text: "function foo() {" },
      { line: 4, text: "return N" },
    ])
  })
})

describe("clusters", () => {
  test("finds the same block in two files", () => {
    const found = clusters({ "a.ts": BLOCK, "b.ts": `const top = 1\n${BLOCK}` }, 4)
    expect(found.length).toBe(1)
    expect(found[0].lines).toBe(7)
    expect(found[0].sites).toEqual([
      { file: "a.ts", start: 1, end: 7 },
      { file: "b.ts", start: 2, end: 8 },
    ])
  })

  test("matches blocks that differ only in literals and spacing", () => {
    const other = BLOCK.replaceAll("fallback", "fallback  ").replace("load(input)", 'load("path")')
    const found = clusters({ "a.ts": BLOCK, "b.ts": other }, 4)
    expect(found.length).toBe(1)
    expect(found[0].sites.map((site) => site.file)).toEqual(["a.ts", "b.ts"])
  })

  test("reports one maximal cluster instead of every window offset", () => {
    const found = clusters({ "a.ts": BLOCK, "b.ts": BLOCK }, 3)
    expect(found.length).toBe(1)
    expect(found[0].lines).toBe(7)
  })

  test("ignores blocks shorter than the window", () => {
    const found = clusters({ "a.ts": "const a = 1\nreturn a", "b.ts": "const a = 1\nreturn a" }, 4)
    expect(found).toEqual([])
  })

  test("finds duplicates within a single file", () => {
    const text = `${BLOCK}\nconst gap = separator()\n${BLOCK}`
    const found = clusters({ "a.ts": text }, 4)
    expect(found.length).toBe(1)
    expect(found[0].sites).toEqual([
      { file: "a.ts", start: 1, end: 7 },
      { file: "a.ts", start: 9, end: 15 },
    ])
  })

  test("ranks bigger clusters first", () => {
    const small = ["alpha(one)", "beta(two)", "gamma(three)", "delta(four)"].join("\n")
    const found = clusters(
      { "a.ts": `${BLOCK}\nbreak1()\n${small}`, "b.ts": `${small}\nbreak2()\n${BLOCK}` },
      4,
    )
    expect(found.length).toBe(2)
    expect(found[0].lines).toBe(7)
    expect(found[1].lines).toBe(4)
  })
})

describe("markdown", () => {
  test("renders ranked sites with line ranges", () => {
    const found = clusters({ "a.ts": BLOCK, "b.ts": BLOCK }, 4)
    const text = markdown(found)
    expect(text).toContain("# Duplicate logic")
    expect(text).toContain("1 clusters found.")
    expect(text).toContain("## 1. 2 sites, ~7 lines each")
    expect(text).toContain("- `a.ts:1-7`")
    expect(text).toContain("- `b.ts:1-7`")
  })

  test("says so when nothing is duplicated", () => {
    expect(markdown([])).toContain("No near-identical blocks found.")
  })

  test("caps output at the limit", () => {
    const found = clusters({ "a.ts": BLOCK, "b.ts": BLOCK }, 4)
    expect(markdown([...found, ...found], 1)).not.toContain("## 2.")
  })
})
