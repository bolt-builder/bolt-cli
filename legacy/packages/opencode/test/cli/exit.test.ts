import { describe, expect, test } from "bun:test"
import { ExitCode } from "../../src/cli/exit"

describe("catalog", () => {
  test("codes are stable across releases", () => {
    // These values are part of the CLI contract; scripts branch on them.
    // Never renumber an existing entry, only append new classes.
    expect({
      OK: ExitCode.OK,
      ERROR: ExitCode.ERROR,
      VERDICT: ExitCode.VERDICT,
      UNKNOWN: ExitCode.UNKNOWN,
      BUDGET: ExitCode.BUDGET,
      AUTH: ExitCode.AUTH,
      TIMEOUT: ExitCode.TIMEOUT,
    }).toEqual({
      OK: 0,
      ERROR: 1,
      VERDICT: 1,
      UNKNOWN: 2,
      BUDGET: 3,
      AUTH: 4,
      TIMEOUT: 5,
    })
  })
})
