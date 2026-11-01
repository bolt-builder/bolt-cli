import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { document, extract, parse } from "../src/commands/handlers/invariants"

describe("extract", () => {
  test("parses dash bullets", () => {
    const text = "Here are the invariants:\n- parse() never throws\n- exit code is 0 on success"
    expect(extract(text)).toEqual(["parse() never throws", "exit code is 0 on success"])
  })

  test("parses star bullets and numbered lists", () => {
    const text = "* stays sorted\n1. no duplicates\n2) preserves order"
    expect(extract(text)).toEqual(["stays sorted", "no duplicates", "preserves order"])
  })

  test("ignores prose and blank lines", () => {
    const text = "I inspected the file.\n\n- the cache key includes the path\n\nThat is all."
    expect(extract(text)).toEqual(["the cache key includes the path"])
  })

  test("trims whitespace around invariants", () => {
    expect(extract("  -   spaced out  ")).toEqual(["spaced out"])
  })

  test("returns empty for text without bullets", () => {
    expect(extract("No list here.")).toEqual([])
  })
})

describe("document and parse", () => {
  test("round-trips files and invariants", () => {
    const rendered = document(["src/a.ts", "src/b.ts"], ["never throws", "returns sorted output"])
    const roundtrip = parse(rendered)
    expect(roundtrip.files).toEqual(["src/a.ts", "src/b.ts"])
    expect(roundtrip.invariants).toEqual(["never throws", "returns sorted output"])
  })

  test("parses a document with no files header", () => {
    const roundtrip = parse("- lonely invariant\n")
    expect(roundtrip.files).toEqual([])
    expect(roundtrip.invariants).toEqual(["lonely invariant"])
  })

  test("renders a markdown document", () => {
    expect(document(["src/a.ts"], ["holds"])).toBe("# Invariants\n\nFiles: src/a.ts\n\n- holds\n")
  })
})

test("rejects oversized and collectively too-large source before contacting an agent", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-invariants-size-"))
  const entry = path.resolve(import.meta.dir, "../src/index.ts")
  const run = async (files: string[]) => {
    const proc = Bun.spawn(
      [process.execPath, "run", "--jsx-import-source=@opentui/solid", entry, "invariants", "state", ...files],
      {
        cwd: root,
        env: { ...process.env, XDG_STATE_HOME: path.join(root, "state") },
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
      },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { stdout, stderr, code }
  }
  try {
    await Bun.$`git init -q ${root}`.quiet()
    await Bun.write(path.join(root, "large.ts"), "a".repeat(24001))
    expect(await run(["large.ts"])).toMatchObject({
      code: 1,
      stderr: expect.stringContaining("File exceeds 24000 bytes"),
    })
    const files = ["a.ts", "b.ts", "c.ts"]
    for (const file of files) await Bun.write(path.join(root, file), "x".repeat(22000))
    expect(await run(files)).toMatchObject({ code: 1, stderr: expect.stringContaining("Selected files exceed") })
    expect(await Bun.file(path.join(root, ".bolt/invariants.md")).exists()).toBe(false)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}, 30000)
