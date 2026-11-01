import { expect, test } from "bun:test"
import { chunkAction, keypress } from "../src/services/voice"

test("voice recording stops on Enter and aborts on Ctrl+C", () => {
  expect(keypress(0x0d)).toBe("stop")
  expect(keypress(0x0a)).toBe("stop")
  expect(keypress(0x03)).toBe("abort")
  expect(keypress(0x61)).toBeUndefined()
  expect(keypress(undefined)).toBeUndefined()
})

test("coalesced input picks the first recognized key", () => {
  expect(chunkAction(Buffer.from([0x61, 0x62, 0x03, 0x0d]))).toBe("abort")
  expect(chunkAction(Buffer.from([0x61, 0x0a, 0x03]))).toBe("stop")
  expect(chunkAction(Buffer.from("typing"))).toBeUndefined()
})
