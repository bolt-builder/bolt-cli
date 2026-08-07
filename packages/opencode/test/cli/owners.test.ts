import { describe, expect, test } from "bun:test"
import { authors, codeowners, markdown, matcher, owner, table } from "../../src/cli/cmd/owners"

describe("codeowners", () => {
  test("parses rules and drops comments and blanks", () => {
    const rules = codeowners(["# comment", "", "*.ts @team/core", "/docs/ @writer @editor # trailing"].join("\n"))
    expect(rules).toEqual([
      { pattern: "*.ts", owners: ["@team/core"] },
      { pattern: "/docs/", owners: ["@writer", "@editor"] },
    ])
  })

  test("ignores patterns without owners", () => {
    expect(codeowners("orphan-pattern")).toEqual([])
  })
})

describe("matcher", () => {
  test("anchors leading slash and scopes single stars to one segment", () => {
    expect(matcher("/src/cli").test("src/cli/run.ts")).toBe(true)
    expect(matcher("/src/cli").test("lib/src/cli/run.ts")).toBe(false)
    expect(matcher("*.ts").test("deep/dir/file.ts")).toBe(true)
    expect(matcher("*.ts").test("file.tsx")).toBe(false)
  })

  test("spans directories with double stars and subtrees with trailing slash", () => {
    expect(matcher("src/**").test("src/a/b/c.ts")).toBe(true)
    expect(matcher("docs/").test("docs/guide/intro.md")).toBe(true)
    expect(matcher("docs/").test("docs")).toBe(false)
  })
})

describe("owner", () => {
  test("last matching rule wins", () => {
    const rules = codeowners(["* @fallback", "src/ @core", "src/cli/ @cli"].join("\n"))
    expect(owner(rules, "src/cli/run.ts")).toEqual(["@cli"])
    expect(owner(rules, "src/db.ts")).toEqual(["@core"])
    expect(owner(rules, "readme.md")).toEqual(["@fallback"])
    expect(owner([], "readme.md")).toEqual([])
  })
})

describe("authors", () => {
  test("attributes numstat lines to the preceding author", () => {
    const log = [
      "\u0001alice",
      "3\t1\tsrc/a.ts",
      "1\t1\tsrc/b.ts",
      "\u0001bob",
      "2\t2\tsrc/a.ts",
      "\u0001alice",
      "5\t0\tsrc/a.ts",
    ].join("\n")
    const history = authors(log)
    expect(history.get("src/a.ts")).toEqual(
      new Map([
        ["alice", 2],
        ["bob", 1],
      ]),
    )
    expect(history.get("src/b.ts")).toEqual(new Map([["alice", 1]]))
  })

  test("resolves rename notation", () => {
    const history = authors(["\u0001alice", "1\t0\tsrc/{old => new}/a.ts"].join("\n"))
    expect(history.get("src/new/a.ts")).toEqual(new Map([["alice", 1]]))
  })
})

describe("table", () => {
  const history = authors(
    [
      "\u0001alice",
      "1\t0\tsrc/cli/a.ts",
      "1\t0\tsrc/cli/b.ts",
      "\u0001bob",
      "1\t0\tsrc/cli/a.ts",
      "1\t0\tdocs/guide.md",
    ].join("\n"),
  )

  test("aggregates commits and shares per directory bucket", () => {
    const rows = table(history, [], 2)
    const cli = rows.find((row) => row.dir === "src/cli")
    expect(cli?.commits).toBe(3)
    expect(cli?.top).toEqual([
      { author: "alice", share: 67 },
      { author: "bob", share: 33 },
    ])
    expect(cli?.declared).toEqual([])
  })

  test("attaches the dominant CODEOWNERS entry and sorts busy directories first", () => {
    const rows = table(history, codeowners("src/ @core"), 2)
    expect(rows[0].dir).toBe("src/cli")
    expect(rows[0].declared).toEqual(["@core"])
    expect(rows.find((row) => row.dir === "docs")?.declared).toEqual([])
  })
})

describe("markdown", () => {
  test("renders the table and counts undeclared directories", () => {
    const history = authors(["\u0001alice", "1\t0\tsrc/cli/a.ts", "1\t0\tdocs/guide.md"].join("\n"))
    const text = markdown(table(history, codeowners("src/ @core"), 2), "1 year")
    expect(text).toContain("1 of 2 directories have no declared owner.")
    expect(text).toContain("| `src/cli` | 1 | alice (100%) | `@core` |")
    expect(text).toContain("| `docs` | 1 | alice (100%) | none |")
  })

  test("handles empty history", () => {
    expect(markdown([], "1 year")).toContain("No commits in the last 1 year.")
  })
})
