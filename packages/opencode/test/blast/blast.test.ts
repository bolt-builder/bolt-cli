import { describe, expect, test } from "bun:test"
import { Blast } from "@/blast"

describe("blast.parse", () => {
  test("parses numstat lines", () => {
    const output = ["10\t2\tpackages/opencode/src/session/session.ts", "0\t5\tREADME.md", ""].join("\n")
    expect(Blast.parse(output)).toEqual([
      { path: "packages/opencode/src/session/session.ts", additions: 10, deletions: 2, binary: false },
      { path: "README.md", additions: 0, deletions: 5, binary: false },
    ])
  })

  test("marks binary files and zeroes their counts", () => {
    expect(Blast.parse("-\t-\tassets/logo.png")).toEqual([
      { path: "assets/logo.png", additions: 0, deletions: 0, binary: true },
    ])
  })

  test("ignores malformed lines", () => {
    expect(Blast.parse("not a numstat line")).toEqual([])
  })
})

describe("blast.kind", () => {
  test("classifies tests, docs, config, and source", () => {
    expect(Blast.kind("packages/opencode/test/tool/edit.test.ts")).toBe("test")
    expect(Blast.kind("packages/opencode/src/tool/edit.spec.ts")).toBe("test")
    expect(Blast.kind("docs/guide.md")).toBe("docs")
    expect(Blast.kind("package.json")).toBe("config")
    expect(Blast.kind(".gitignore")).toBe("config")
    expect(Blast.kind("packages/opencode/src/tool/edit.ts")).toBe("source")
  })
})

describe("blast.pkg", () => {
  test("maps paths to workspace packages", () => {
    expect(Blast.pkg("packages/opencode/src/index.ts")).toBe("opencode")
    expect(Blast.pkg("packages/core/src/redact.ts")).toBe("core")
    expect(Blast.pkg("scripts/build.ts")).toBe("root")
  })
})

describe("blast.stem", () => {
  test("uses the filename without extension", () => {
    expect(Blast.stem("packages/opencode/src/session/session.ts")).toBe("session")
    expect(Blast.stem("src/tool/edit.test.ts")).toBe("edit.test")
  })

  test("uses the directory name for index files", () => {
    expect(Blast.stem("packages/opencode/src/blast/index.ts")).toBe("blast")
  })

  test("skips src for top-level index files", () => {
    expect(Blast.stem("packages/opencode/src/index.ts")).toBe("opencode")
  })
})

describe("blast.risk", () => {
  test("grades wide changes as high", () => {
    expect(Blast.risk({ source: 2, tests: 1, packages: 1, dependents: 40 })).toBe("high")
    expect(Blast.risk({ source: 25, tests: 0, packages: 1, dependents: 0 })).toBe("high")
    expect(Blast.risk({ source: 1, tests: 0, packages: 3, dependents: 0 })).toBe("high")
  })

  test("grades moderate changes as medium", () => {
    expect(Blast.risk({ source: 5, tests: 2, packages: 1, dependents: 0 })).toBe("medium")
    expect(Blast.risk({ source: 1, tests: 0, packages: 2, dependents: 0 })).toBe("medium")
    expect(Blast.risk({ source: 1, tests: 0, packages: 1, dependents: 5 })).toBe("medium")
  })

  test("grades small contained changes as low", () => {
    expect(Blast.risk({ source: 1, tests: 1, packages: 1, dependents: 2 })).toBe("low")
  })
})
