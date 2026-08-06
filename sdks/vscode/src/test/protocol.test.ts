import * as assert from "node:assert"
import { up } from "../protocol"

suite("protocol", () => {
  test("accepts well formed upward messages", () => {
    assert.deepStrictEqual(up({ v: 1, type: "ready" }), { v: 1, type: "ready" })
    assert.deepStrictEqual(up({ v: 1, type: "stop" }), { v: 1, type: "stop" })
    assert.deepStrictEqual(up({ v: 1, type: "newSession" }), { v: 1, type: "newSession" })
    assert.deepStrictEqual(up({ v: 1, type: "prompt", text: "hi" }), { v: 1, type: "prompt", text: "hi" })
  })

  test("rejects unknown versions", () => {
    assert.strictEqual(up({ v: 2, type: "ready" }), undefined)
    assert.strictEqual(up({ type: "ready" }), undefined)
  })

  test("rejects malformed messages", () => {
    assert.strictEqual(up(undefined), undefined)
    assert.strictEqual(up("prompt"), undefined)
    assert.strictEqual(up({ v: 1, type: "prompt" }), undefined)
    assert.strictEqual(up({ v: 1, type: "prompt", text: 42 }), undefined)
    assert.strictEqual(up({ v: 1, type: "unknown" }), undefined)
  })
})
