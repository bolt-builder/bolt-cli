import { expect, test } from "bun:test"
import { logo } from "../../src/logo"
import { epilogue } from "../../src/util/presentation"

const rows = (text: string | undefined) =>
  Bun.stripANSI(text ?? "")
    .split("\n")
    .filter((line) => /^\s+(?:Session|Continue|Run)\b/.test(line))

test("prints nothing without a session or update", () => {
  expect(epilogue({})).toBeUndefined()
})

test("formats session continuation summary", () => {
  expect(rows(epilogue({ session: { title: "A session", sessionID: "ses_123" } }))).toEqual([
    "  Session   A session",
    "  Continue  bolt -s ses_123",
  ])
})

test("tells the user to start Bolt again after an update", () => {
  expect(rows(epilogue({ updatedVersion: "2.0.0" }))).toEqual(["  Run bolt to use 2.0.0"])
})

test("keeps the session continuation after an update", () => {
  expect(rows(epilogue({ session: { title: "A session", sessionID: "ses_123" }, updatedVersion: "2.0.0" }))).toEqual([
    "  Run bolt to use 2.0.0",
    "  Session   A session",
    "  Continue  bolt -s ses_123",
  ])
})

test("renders the Bolt artwork literally including underscore strokes", () => {
  const lines = Bun.stripANSI(epilogue({ updatedVersion: "2.0.0" }) ?? "").split("\n")
  expect(lines.slice(0, logo.left.length)).toEqual(logo.left.map((line, index) => `  ${line} ${logo.right[index]}`))
})

test("keeps the active theme's Bolt gradient in the exit wordmark", () => {
  const text = epilogue({
    session: { title: "Custom theme", sessionID: "ses_custom", brand: { accent: "#112233", primary: "#aabbcc" } },
  })!
  expect(text).toContain("\x1b[38;2;17;34;51m")
  expect(text).toContain("\x1b[38;2;170;187;204m")
})
