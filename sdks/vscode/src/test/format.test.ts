import * as assert from "node:assert"
import { display, reference } from "../format"

suite("format", () => {
  test("reference without lines", () => {
    assert.strictEqual(reference({ file: "src/extension.ts" }), "@src/extension.ts")
  })

  test("reference with a single line", () => {
    assert.strictEqual(reference({ file: "src/extension.ts", start: 12 }), "@src/extension.ts#12")
    assert.strictEqual(reference({ file: "src/extension.ts", start: 12, end: 12 }), "@src/extension.ts#12")
  })

  test("reference with a range", () => {
    assert.strictEqual(reference({ file: "src/extension.ts", start: 12, end: 40 }), "@src/extension.ts#12-40")
  })

  test("display is relative inside the root", () => {
    assert.strictEqual(display("/work/repo/src/a.ts", "/work/repo"), "src/a.ts")
  })

  test("display is absolute outside the root", () => {
    assert.strictEqual(display("/elsewhere/a.ts", "/work/repo"), "/elsewhere/a.ts")
    assert.strictEqual(display("/work/repo-sibling/a.ts", "/work/repo"), "/work/repo-sibling/a.ts")
  })

  test("display is absolute without a root", () => {
    assert.strictEqual(display("/work/a.ts"), "/work/a.ts")
  })
})
