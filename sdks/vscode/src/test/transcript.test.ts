import * as assert from "node:assert"
import type { Message } from "../protocol"
import { append, CAP } from "../transcript"

suite("transcript", () => {
  test("appends messages in order", () => {
    const one = append([], { role: "user", text: "a" })
    const two = append(one, { role: "assistant", text: "b" })
    assert.deepStrictEqual(
      two.map((message) => message.text),
      ["a", "b"],
    )
  })

  test("caps the transcript at the newest messages", () => {
    const full = Array.from({ length: CAP }, (_, index): Message => ({ role: "user", text: String(index) }))
    const result = append(full, { role: "assistant", text: "newest" })
    assert.strictEqual(result.length, CAP)
    assert.strictEqual(result.at(-1)?.text, "newest")
    assert.strictEqual(result[0]?.text, "1")
  })
})
