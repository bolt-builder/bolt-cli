import { describe, expect, test } from "bun:test"
import { FileRank } from "@/file/rank"

describe("file.rank", () => {
  test("keeps the caller's order without signals", () => {
    const paths = ["src/a.ts", "src/b.ts", "src/c.ts"]
    expect(FileRank.rank({ paths, signals: {} })).toEqual(paths)
  })

  test("puts hot files before untouched ones", () => {
    const ranked = FileRank.rank({
      paths: ["src/a.ts", "src/b.ts", "src/c.ts"],
      signals: { "src/c.ts": { hot: true } },
    })
    expect(ranked).toEqual(["src/c.ts", "src/a.ts", "src/b.ts"])
  })

  test("puts failing files before hot files", () => {
    const ranked = FileRank.rank({
      paths: ["src/a.ts", "src/b.ts", "src/c.ts"],
      signals: { "src/b.ts": { hot: true }, "src/c.ts": { failing: true } },
    })
    expect(ranked).toEqual(["src/c.ts", "src/b.ts", "src/a.ts"])
  })

  test("puts failing and hot files first overall", () => {
    const ranked = FileRank.rank({
      paths: ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"],
      signals: {
        "src/b.ts": { failing: true },
        "src/d.ts": { failing: true, hot: true },
      },
    })
    expect(ranked).toEqual(["src/d.ts", "src/b.ts", "src/a.ts", "src/c.ts"])
  })

  test("preserves relevance order within a tier", () => {
    const ranked = FileRank.rank({
      paths: ["src/a.ts", "src/b.ts", "src/c.ts"],
      signals: { "src/a.ts": { hot: true }, "src/c.ts": { hot: true } },
    })
    expect(ranked).toEqual(["src/a.ts", "src/c.ts", "src/b.ts"])
  })

  test("ignores signals for paths that were not found", () => {
    const ranked = FileRank.rank({
      paths: ["src/a.ts"],
      signals: { "src/zz.ts": { failing: true } },
    })
    expect(ranked).toEqual(["src/a.ts"])
  })
})
