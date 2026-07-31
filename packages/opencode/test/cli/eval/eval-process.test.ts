// End-to-end tests for `bolt eval`: spawn the real CLI against the mock LLM,
// grade a passing and a failing case, and assert the JSON report + exit code.
import { describe, expect } from "bun:test"
import { Effect } from "effect"
import path from "node:path"
import { cliIt, testModelID } from "../../lib/cli-process"

const passCase = `---
expect:
  - type: file_contains
    path: out.txt
    text: hello
---
Create out.txt containing hello.
`

const failCase = `---
expect:
  - type: file_exists
    path: missing.txt
---
Do nothing.
`

describe("bolt eval", () => {
  cliIt.concurrent(
    "grades cases and reports results as json",
    ({ llm, home, opencode }) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => Bun.write(path.join(home, "evals/a-fail.md"), failCase))
        yield* Effect.promise(() => Bun.write(path.join(home, "evals/b-pass.md"), passCase))

        // Cases run in sorted file order: a-fail first (one text turn), then
        // b-pass (bash tool call writing out.txt, then a closing text turn).
        yield* llm.text("done")
        yield* llm.tool("bash", { command: "echo hello > out.txt", description: "Write out.txt" })
        yield* llm.text("done")

        const result = yield* opencode.spawn(["eval", "evals", "--model", testModelID, "--format", "json"], {
          timeoutMs: 120_000,
        })
        opencode.expectExit(result, 1, "eval")

        const events = opencode.parseJsonEvents(result.stdout)
        const cases = events.filter((event) => event.type === "eval_case")
        expect(cases).toHaveLength(2)

        const failed = cases.find((event) => event.name === "a-fail")
        expect(failed?.passed).toBe(false)
        const passedCase = cases.find((event) => event.name === "b-pass")
        expect(passedCase?.passed).toBe(true)

        const summary = events.find((event) => event.type === "eval_summary")
        expect(summary?.total).toBe(2)
        expect(summary?.passed).toBe(1)
        expect(summary?.failed).toBe(1)
      }),
    240_000,
  )

  cliIt.concurrent("fails when no cases are found", ({ opencode }) =>
    Effect.gen(function* () {
      const result = yield* opencode.spawn(["eval", "does-not-exist"], { timeoutMs: 60_000 })
      opencode.expectExit(result, 1, "eval-missing")
      expect(result.stderr).toContain("does-not-exist")
    }),
  )
})
