import { describe, expect, test } from "bun:test"
import { candidates } from "../../src/cli/cmd/proptest"

describe("candidates", () => {
  test("finds exported function declarations", () => {
    const source = "export function parse(text: string) {\n  return text\n}"
    expect(candidates(source)).toEqual([
      { name: "parse", line: 1, signature: "export function parse(text: string) {" },
    ])
  })

  test("finds exported arrow constants", () => {
    const source = "export const double = (value: number) => value * 2"
    expect(candidates(source)).toEqual([
      { name: "double", line: 1, signature: "export const double = (value: number) => value * 2" },
    ])
  })

  test("skips async functions", () => {
    expect(candidates("export async function load(url: string) {")).toEqual([])
  })

  test("skips generators", () => {
    expect(candidates("export function* walk(root: string) {")).toEqual([])
  })

  test("skips async arrow constants", () => {
    expect(candidates("export const fetcher = async (url: string) => fetch(url)")).toEqual([])
  })

  test("skips non-function exports", () => {
    expect(candidates('export const LIMIT = 120_000\nexport const NAME = "bolt"')).toEqual([])
  })

  test("skips unexported functions", () => {
    expect(candidates("function helper(a: number) {\n  return a\n}")).toEqual([])
  })

  test("reports one-based line numbers across a file", () => {
    const source = "const a = 1\n\nexport function first() {\n}\n\nexport const second = () => 2"
    const found = candidates(source)
    expect(found.map((candidate) => [candidate.name, candidate.line])).toEqual([
      ["first", 3],
      ["second", 6],
    ])
  })

  test("truncates very long signatures", () => {
    const source = `export function long(${"a: number, ".repeat(40)}) {`
    const found = candidates(source)
    expect(found[0].signature.length).toBe(200)
  })
})
