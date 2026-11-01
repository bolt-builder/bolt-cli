import { Effect, Option } from "effect"
import { ChildProcess } from "effect/process"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { answer } from "../../services/answer"
import { errorMessage } from "../../util/error"
import { validModel } from "./ask"

const LIMIT = 60_000

/** Strip think blocks and markdown fences from a generated commit message. */
export function clean(text: string) {
  const lines = text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .trim()
    .split("\n")
  if (lines[0]?.startsWith("```")) lines.shift()
  if (lines.at(-1)?.startsWith("```")) lines.pop()
  return lines.join("\n").trim()
}

/** Cap a diff for the prompt, keeping the head where the summary lives. */
export function cap(patch: string, limit = LIMIT) {
  if (patch.length <= limit) return patch
  return `${patch.slice(0, limit)}\n\n[diff truncated]`
}

export default Runtime.handler(Commands.commands.commit, (input) =>
  Effect.gen(function* () {
    const model = Option.getOrUndefined(input.model)
    if (model && !validModel(model))
      return yield* Effect.fail(new Error("Provide --model in the format provider/model."))
    const processService = yield* AppProcess.Service
    const git = (args: string[], cwd: string) => processService.run(ChildProcess.make("git", args, { cwd }))
    const root = yield* git(["rev-parse", "--show-toplevel"], process.cwd()).pipe(
      Effect.flatMap(AppProcess.requireSuccess),
    )
    const cwd = root.stdout.toString().trim()
    if (input.all && (yield* git(["rev-parse", "--verify", "HEAD"], cwd)).exitCode !== 0)
      return yield* Effect.fail(
        new Error("--all requires at least one commit. Stage changes and run bolt commit instead."),
      )
    const diff = yield* git(input.all ? ["diff", "HEAD"] : ["diff", "--cached"], cwd).pipe(
      Effect.flatMap(AppProcess.requireSuccess),
    )
    const patch = diff.stdout.toString().trim()
    if (!patch)
      return yield* Effect.fail(
        new Error(
          input.all
            ? "No changes to commit."
            : "No staged changes to commit. Stage changes with git add, or pass --all to commit every tracked change.",
        ),
      )
    const log = yield* git(["log", "--format=%s", "-10"], cwd)
    const subjects = log.exitCode === 0 ? log.stdout.toString().trim() : ""
    process.stderr.write("Generating commit message...\n")
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
          agent: "commit",
          model,
          title: "bolt commit",
          text: [
            "Write a commit message for the following staged changes.",
            subjects ? `\nRecent commit subjects for style reference:\n${subjects}` : "",
            `\nDiff:\n${cap(patch)}`,
          ].join("\n"),
        }),
      catch: (cause) => cause,
    })
    const message = clean(text)
    if (!message) return yield* Effect.fail(new Error("The model returned an empty commit message."))
    if (input.dryRun) {
      process.stdout.write(message + "\n")
      return
    }
    const committed = yield* git(input.all ? ["commit", "-a", "-m", message] : ["commit", "-m", message], cwd).pipe(
      Effect.flatMap(AppProcess.requireSuccess),
    )
    process.stdout.write(committed.stdout.toString().trim() + "\n")
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
