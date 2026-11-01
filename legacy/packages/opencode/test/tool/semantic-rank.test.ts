import { test, expect } from "bun:test"
import { SemanticRank } from "@/tool/semantic-rank"

test("split breaks camelCase and acronym boundaries", () => {
  expect(SemanticRank.split("parseConfig")).toEqual(["parse", "config"])
  expect(SemanticRank.split("parseHTTPRequest")).toEqual(["parse", "http", "request"])
  expect(SemanticRank.split("HTMLElement")).toEqual(["html", "element"])
  expect(SemanticRank.split("x")).toEqual([])
})

test("stem collapses common suffixes conservatively", () => {
  expect(SemanticRank.stem("caches")).toBe("cach")
  expect(SemanticRank.stem("cached")).toBe("cach")
  expect(SemanticRank.stem("caching")).toBe("cach")
  expect(SemanticRank.stem("retries")).toBe("retry")
  expect(SemanticRank.stem("class")).toBe("class")
  expect(SemanticRank.stem("its")).toBe("its")
})

test("tokenize splits snake_case, stems, and drops stopwords", () => {
  expect(SemanticRank.tokenize("const session_tokens = refreshSessions()")).toEqual([
    "session",
    "token",
    "refresh",
    "session",
  ])
})

test("weights boost tokens on definition lines", () => {
  const defined = SemanticRank.weights("function refreshSession() {")
  const used = SemanticRank.weights("refreshSession()")
  expect(defined.get("refresh")).toBe(3)
  expect(used.get("refresh")).toBe(1)
})

test("chunk produces overlapping 1-based line windows covering the file", () => {
  const content = Array.from({ length: 75 }, (_, index) => `line ${index + 1}`).join("\n")
  const chunks = SemanticRank.chunk("a.ts", content)
  expect(chunks[0].start).toBe(1)
  expect(chunks[0].end).toBe(40)
  expect(chunks[1].start).toBe(31)
  expect(chunks.at(-1)?.end).toBe(75)
  expect(chunks.every((item) => item.file === "a.ts")).toBe(true)
})

test("chunk skips blank windows", () => {
  expect(SemanticRank.chunk("a.ts", "\n\n\n")).toEqual([])
})

test("rank finds chunks by meaning-bearing tokens across naming styles", () => {
  const chunks = [
    { file: "a.ts", start: 1, end: 5, text: "function refresh_session(token) {\n  rotate(token)\n}" },
    { file: "b.ts", start: 1, end: 5, text: "function renderButton() {\n  paint()\n}" },
  ]
  const hits = SemanticRank.rank("refreshSession", chunks)
  expect(hits).toHaveLength(1)
  expect(hits[0].chunk.file).toBe("a.ts")
  expect(hits[0].score).toBeGreaterThan(0)
})

test("rank prefers defining chunks over mere usage", () => {
  const definition = { file: "def.ts", start: 1, end: 3, text: "export function scheduleRetry() {\n  queue()\n}" }
  const usage = { file: "use.ts", start: 1, end: 3, text: "scheduleRetry()" }
  const hits = SemanticRank.rank("schedule retry", [definition, usage])
  expect(hits[0].chunk.file).toBe("def.ts")
  expect(hits[1].chunk.file).toBe("use.ts")
})

test("rank weighs rare terms above ubiquitous ones", () => {
  const noise = Array.from({ length: 20 }, (_, index) => ({
    file: `noise${index}.ts`,
    start: 1,
    end: 2,
    text: "session handler",
  }))
  const gold = { file: "gold.ts", start: 1, end: 2, text: "session watchdog" }
  const hits = SemanticRank.rank("session watchdog", [...noise, gold])
  expect(hits[0].chunk.file).toBe("gold.ts")
})

test("rank returns empty for stopword-only queries", () => {
  const chunks = [{ file: "a.ts", start: 1, end: 1, text: "anything" }]
  expect(SemanticRank.rank("the of and", chunks)).toEqual([])
})

test("snippet anchors above the first matching line and numbers lines", () => {
  const item = {
    file: "a.ts",
    start: 10,
    end: 15,
    text: ["// header", "// filler", "function payoutLedger() {", "  return total", "}"].join("\n"),
  }
  const output = SemanticRank.snippet(item, SemanticRank.tokenize("payout ledger"), 3)
  expect(output).toBe(["11: // filler", "12: function payoutLedger() {", "13:   return total"].join("\n"))
})

test("snippet falls back to the chunk head when nothing matches", () => {
  const item = { file: "a.ts", start: 1, end: 2, text: "alpha\nbeta" }
  expect(SemanticRank.snippet(item, ["nomatch"], 1)).toBe("1: alpha")
})
