import { describe, expect, test } from "bun:test"
import { HINT, keypress } from "../../src/cli/voice"

describe("keypress", () => {
  test("enter and newline stop the recording", () => {
    expect(keypress(0x0d)).toBe("stop")
    expect(keypress(0x0a)).toBe("stop")
  })

  test("ctrl+c aborts", () => {
    expect(keypress(0x03)).toBe("abort")
  })

  test("other bytes are ignored", () => {
    expect(keypress(0x61)).toBeUndefined()
    expect(keypress(0x1b)).toBeUndefined()
    expect(keypress(undefined)).toBeUndefined()
  })
})

describe("hint", () => {
  test("names the whisper.cpp requirement and the overrides", () => {
    expect(HINT).toContain("whisper.cpp")
    expect(HINT).toContain("OPENCODE_VOICE_WHISPER")
    expect(HINT).toContain("OPENCODE_VOICE_MODEL")
  })
})
