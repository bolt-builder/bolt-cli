import { expect, test } from "bun:test"
import { keypress } from "../src/services/voice"

test("voice recording stops on Enter and aborts on Ctrl+C", () => {
  expect(keypress(0x0d)).toBe("stop")
  expect(keypress(0x0a)).toBe("stop")
  expect(keypress(0x03)).toBe("abort")
  expect(keypress(0x61)).toBeUndefined()
  expect(keypress(undefined)).toBeUndefined()
})
