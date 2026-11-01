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
import { errorMessage } from "../../util/error"
import { parseSessionTargetModel } from "../../session-target"
import { Git } from "../../services/git"
import { verdict } from "../../services/review"

const LIMIT = 120_000

/** Decide what the pipeline does after a review stage completes. A missing verdict counts as a failure. */
export function decide(outcome: "pass" | "fail" | undefined, attempt: number, attempts: number) {
  if (outcome === "pass") return "pass" as const
  if (attempt >= attempts) return "stop" as const
  return "retry" as const
}

/** Extract the concrete defect list from a review response, dropping the verdict marker. */
export function defects(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*]|\d+[.)])\s+/.test(line))
    .filter((line) => !/verdict:\s*(pass|fail)/i.test(line))
}

/** Reviewer feedback for the next code attempt: the defect list, or the full response minus the verdict line. */
export function feedback(review: string) {
  const items = defects(review)
  if (items.length > 0) return items.join("\n")
  return review
    .split("\n")
    .filter((line) => !/verdict:\s*(pass|fail)/i.test(line))
    .join("\n")
    .trim()
}

/** Stage banner printed at each pipeline transition. */
export function banner(stage: string, attempt: number, attempts: number) {
  const suffix = attempts > 1 ? ` (attempt ${attempt}/${attempts})` : ""
  return `── ${stage}${suffix} ──`
}

export function planPrompt(task: string) {
  return [
    "You are the planning stage of a three-stage pipeline (plan, code, review).",
    "Produce a numbered implementation plan for the task below. Use the read, grep, and glob tools to inspect the codebase first.",
    "Each step must name the files to touch and describe the change to make. Do not make any changes yourself.",
    "",
    `Task: ${task}`,
  ].join("\n")
}

export function codePrompt(task: string, plan: string, fixes?: string) {
  const parts = [
    "You are the coding stage of a three-stage pipeline (plan, code, review).",
    "Implement the plan below exactly. Make the edits and run any commands you need. Do not ask questions.",
    "",
    `Task: ${task}`,
    "",
    "Plan:",
    plan,
  ]
  if (fixes) parts.push("", "A reviewer found these defects in the previous attempt. Fix all of them:", fixes)
  return parts.join("\n")
}

export function reviewPrompt(task: string, plan: string, diff: string) {
  return [
    "You are the review stage of a three-stage pipeline (plan, code, review).",
    "Review the diff below against the task and plan. Use the read, grep, and glob tools to inspect surrounding code when the diff alone is not enough.",
    "List each concrete defect as a bullet with the file, line, and a short explanation. Do not restate the diff.",
    'End your final message with exactly one line: "Verdict: PASS" if the implementation is correct and complete, otherwise "Verdict: FAIL".',
    "",
    `Task: ${task}`,
    "",
    "Plan:",
    plan,
    "",
    "Diff:",
    diff,
  ].join("\n")
}

export default Runtime.handler(Commands.commands.pipeline, (input) =>
  Effect.gen(function* () {
    if (input.attempts < 1) return yield* Effect.fail(new Error("--attempts must be a positive integer"))
    const model = Option.getOrUndefined(input.model)
    if (model !== undefined) parseSessionTargetModel(model)
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const cwd = root.stdout.toString().trim()
    const head = yield* git.run(["rev-parse", "HEAD"], cwd).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const base = head.stdout.toString().trim()
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    const stage = (agent: string, title: string, text: string, code = false) =>
      Effect.tryPromise({
        try: () =>
          execute({
            client,
            agent,
            model,
            title,
            text,
            directory: cwd,
            retain: true,
            permissions: code
              ? [
                  { action: "edit", resource: "*", effect: "allow" },
                  { action: "shell", resource: "*", effect: "allow" },
                ]
              : [
                  { action: "edit", resource: "*", effect: "deny" },
                  { action: "shell", resource: "*", effect: "deny" },
                ],
          }).then((result) => result.text),
        catch: (cause) => cause,
      })
    process.stdout.write(banner("plan", 1, 1) + "\n")
    const plan = yield* stage("plan", "bolt pipeline plan", planPrompt(input.task))
    process.stdout.write(plan + "\n")
    let fixes: string | undefined
    for (let attempt = 1; attempt <= input.attempts; attempt++) {
      process.stdout.write(banner("code", attempt, input.attempts) + "\n")
      yield* stage("build", `bolt pipeline code ${attempt}`, codePrompt(input.task, plan, fixes), true)
      const diff = yield* git.run(["diff", base], cwd).pipe(Effect.flatMap(AppProcess.requireSuccess))
      const patch = diff.stdout.toString().trim()
      if (!patch) return yield* Effect.fail(new Error("The code stage made no changes to tracked files."))
      if (patch.length > LIMIT)
        return yield* Effect.fail(new Error("The working tree diff is too large to review in one shot."))
      process.stdout.write(banner("review", attempt, input.attempts) + "\n")
      const review = yield* stage(
        "code-review",
        `bolt pipeline review ${attempt}`,
        reviewPrompt(input.task, plan, patch),
      )
      process.stdout.write(review + "\n")
      const action = decide(verdict(review), attempt, input.attempts)
      if (action === "pass") {
        process.stdout.write("Pipeline passed review.\n")
        return
      }
      if (action === "stop")
        return yield* Effect.fail(
          new Error(`Pipeline failed review after ${attempt} attempt${attempt > 1 ? "s" : ""}.`),
        )
      fixes = feedback(review)
      process.stdout.write("Review failed. Retrying the code stage with the defect list.\n")
    }
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
