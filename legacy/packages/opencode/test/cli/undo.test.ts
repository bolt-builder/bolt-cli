import { describe, expect, test } from "bun:test"
import { target } from "@/cli/cmd/undo"

describe("cli.undo target", () => {
  test("picks the most recent user message", () => {
    const messages = [
      { id: "msg_01", role: "user" },
      { id: "msg_02", role: "assistant" },
      { id: "msg_03", role: "user" },
      { id: "msg_04", role: "assistant" },
    ]
    expect(target(messages)).toBe("msg_03")
  })

  test("stacked undo rewinds to the user message before the marker", () => {
    const messages = [
      { id: "msg_01", role: "user" },
      { id: "msg_02", role: "assistant" },
      { id: "msg_03", role: "user" },
      { id: "msg_04", role: "assistant" },
    ]
    expect(target(messages, "msg_03")).toBe("msg_01")
  })

  test("returns undefined when there is no user message", () => {
    expect(target([{ id: "msg_01", role: "assistant" }])).toBeUndefined()
    expect(target([])).toBeUndefined()
  })

  test("returns undefined when the marker is already at the first user message", () => {
    const messages = [
      { id: "msg_01", role: "user" },
      { id: "msg_02", role: "assistant" },
    ]
    expect(target(messages, "msg_01")).toBeUndefined()
  })

  test("ignores user messages at or after the marker", () => {
    const messages = [
      { id: "msg_01", role: "user" },
      { id: "msg_02", role: "user" },
      { id: "msg_03", role: "user" },
    ]
    expect(target(messages, "msg_02")).toBe("msg_01")
  })
})
