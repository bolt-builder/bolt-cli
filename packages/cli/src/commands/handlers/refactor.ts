import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { execute } from "../../services/answer"
import { confidence, CONFIDENCE, INSTRUCTIONS, verdict } from "../../services/review"
import { parseSessionTargetModel } from "../../session-target"
import { errorMessage } from "../../util/error"
import { Git } from "../../services/git"
import { runTestCommand } from "../../services/test-command"

export function tail(output: string, limit = 20_000) {
  const trimmed = output.trim()
  return trimmed.length <= limit ? trimmed : `[output truncated]\n${trimmed.slice(-limit)}`
}

export default Runtime.handler(Commands.commands.refactor, (input) =>
  Effect.gen(function* () {
    if (input.attempts < 1) return yield* Effect.fail(new Error("--attempts must be a positive integer"))
    const model = Option.getOrUndefined(input.model)
    if (model !== undefined) parseSessionTargetModel(model)
    const cwd = process.cwd()
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    let sessionID: string | undefined
    const send = (text: string) =>
      Effect.tryPromise({
        try: () =>
          execute({
            client,
            sessionID,
            agent: "build",
            title: "bolt refactor",
            model,
            directory: cwd,
            text: input.confidence ? `${text}\n\n${CONFIDENCE}` : text,
            retain: true,
          }),
        catch: (cause) => cause,
      }).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            sessionID = result.sessionID
          }),
        ),
        Effect.map((result) => result.text),
      )
    process.stdout.write("Refactoring...\n")
    let latest = yield* send(input.instruction)
    for (let attempt = 1; attempt <= input.attempts; attempt++) {
      process.stdout.write(`Running tests (attempt ${attempt}/${input.attempts}): ${input.test}\n`)
      const run = yield* runTestCommand(input.test, cwd)
      if (run.exitCode === 0) {
        process.stdout.write("Tests are green. Refactor complete.\n")
        if (input.confidence) {
          const level = confidence(latest)
          process.stdout.write(
            level
              ? `Confidence: ${level.toUpperCase()}\n`
              : "Could not determine a confidence level from the response.\n",
          )
        }
        if (!input.selfReview) return
        const git = yield* Git.make
        const diff = yield* git.run(["diff"], cwd)
        if (diff.exitCode !== 0) {
          process.stdout.write(`Skipping self-review: ${diff.stderr.toString().trim() || "git diff failed"}\n`)
          return
        }
        const patch = diff.stdout.toString().trim()
        if (!patch) {
          process.stdout.write("Nothing to self-review: git diff is empty.\n")
          return
        }
        if (patch.length > 120_000) {
          process.stdout.write("Skipping self-review: the diff is too large to review in one shot.\n")
          return
        }
        const review = yield* Effect.tryPromise({
          try: () =>
            execute({
              client,
              model,
              directory: cwd,
              retain: true,
              agent: "code-review",
              title: "bolt refactor self-review",
              text: `${INSTRUCTIONS}\n\nDiff:\n${patch}`,
            }),
          catch: (cause) => cause,
        }).pipe(
          Effect.map((result) => result.text),
          Effect.catch((error) =>
            Effect.sync(() => {
              process.stdout.write(`Skipping self-review: ${errorMessage(error)}\n`)
              return ""
            }),
          ),
        )
        if (!review) return
        process.stdout.write(review + "\n")
        const outcome = verdict(review)
        process.stdout.write(
          outcome === "fail"
            ? "Warning: self-review verdict is FAIL. Changes were kept; review the diff before committing.\n"
            : outcome === "pass"
              ? "Self-review verdict: PASS\n"
              : "Could not determine a verdict from the self-review.\n",
        )
        return
      }
      if (attempt === input.attempts) break
      process.stdout.write(`Tests failed with exit code ${run.exitCode}. Asking the agent to fix...\n`)
      latest = yield* send(
        `The test command \`${input.test}\` failed with exit code ${run.exitCode} after your changes.\nFix the failures and keep the refactor intact. Output (tail):\n\n${tail(`${run.stdout}\n${run.stderr}`)}`,
      )
    }
    return yield* Effect.fail(
      new Error(`Tests still failing after ${input.attempts} attempt${input.attempts === 1 ? "" : "s"}.`),
    )
  }).pipe(
    Effect.provide(LayerNode.compile(AppProcess.node)),
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
