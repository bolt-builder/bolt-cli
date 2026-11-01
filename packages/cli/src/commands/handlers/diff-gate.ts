import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { answer } from "../../services/answer"
import { INSTRUCTIONS, verdict } from "../../services/review"
import { errorMessage } from "../../util/error"
import { readStdin } from "../../util/io"
import { validModel } from "./ask"

export const SEVERITIES = ["minor", "major", "critical"] as const
export type Severity = (typeof SEVERITIES)[number]

/** Numeric rank for comparing severities. */
export function rank(severity: Severity) {
  return SEVERITIES.indexOf(severity)
}

export interface Issue {
  severity: Severity
  line: string
}

/**
 * Extract reported defects from a review response. The review agent is asked
 * to report each issue as a list item with a severity, so only list items
 * carrying a severity word count; the verdict marker line never does.
 */
export function issues(text: string): Issue[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*]|\d+[.)])\s+/.test(line))
    .flatMap((line) => {
      const match = line.match(/\b(critical|major|minor)\b/i)
      if (!match) return []
      return [{ severity: match[1].toLowerCase() as Severity, line }]
    })
}

/** Issues at or above the threshold; these fail the gate. */
export function blocking(found: Issue[], threshold: Severity) {
  return found.filter((issue) => rank(issue.severity) >= rank(threshold))
}

export default Runtime.handler(Commands.commands["diff-gate"], (input) =>
  Effect.gen(function* () {
    if (process.stdin.isTTY)
      return yield* Effect.fail(
        new Error("No diff on stdin. Pipe one in, e.g.: git diff origin/dev...HEAD | bolt diff-gate"),
      )
    const model = Option.getOrUndefined(input.model)
    if (model && !validModel(model))
      return yield* Effect.fail(new Error("Provide --model in the format provider/model."))
    const patch = (yield* Effect.promise(() => readStdin())).trim()
    if (!patch) return yield* Effect.fail(new Error("The diff on stdin is empty."))
    if (patch.length > 120_000)
      return yield* Effect.fail(new Error("The diff is too large to review in one shot. Gate a narrower range."))
    process.stderr.write(`Reviewing diff (${patch.length} chars, threshold: ${input.threshold})...\n`)
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    const text = yield* Effect.tryPromise({
      try: () =>
        answer({
          client,
          title: "bolt diff-gate",
          agent: "code-review",
          model,
          text: `${INSTRUCTIONS}\n\nDiff:\n${patch}`,
        }),
      catch: (cause) => cause,
    })
    process.stdout.write(text + "\n")
    const found = issues(text)
    const failing = blocking(found, input.threshold)
    if (failing.length) {
      process.stderr.write(
        `${failing.length} defect${failing.length === 1 ? "" : "s"} at or above ${input.threshold}\n`,
      )
      process.exitCode = 1
      return
    }
    if (found.length) {
      process.stderr.write(
        `${found.length} defect${found.length === 1 ? "" : "s"} below the ${input.threshold} threshold.\n`,
      )
      return
    }
    const outcome = verdict(text)
    if (outcome === "pass") return
    if (outcome === "fail") {
      process.stderr.write("The review reported a failing verdict.\n")
      process.exitCode = 1
      return
    }
    process.stderr.write("Could not determine a verdict from the review.\n")
    process.exitCode = 2
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
