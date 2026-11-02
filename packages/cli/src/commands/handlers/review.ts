import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { answer } from "../../services/answer"
import { CONFIDENCE, INSTRUCTIONS, confidence, verdict } from "../../services/review"
import { Git } from "../../services/git"
import { Signature } from "../../services/signature"
import { Envelope } from "../../util/envelope"
import { Porcelain } from "../../util/porcelain"
import { errorMessage } from "../../util/error"
import { readStdin } from "../../util/io"
import { validModel } from "./ask"

export default Runtime.handler(Commands.commands.review, (input) =>
  Effect.gen(function* () {
    if (Option.isSome(input.branchTarget) && (Option.isNone(input.branch) || input.branch.value))
      return yield* Effect.fail(new Error(`Unexpected argument: ${input.branchTarget.value}`))
    const branch = Option.isSome(input.branchTarget) ? input.branchTarget : input.branch
    if (input.json && input.porcelain)
      return yield* Effect.fail(new Error("--json and --porcelain cannot be used together"))
    if (input.staged && Option.isSome(branch))
      return yield* Effect.fail(new Error("--staged and --branch cannot be used together"))
    const model = Option.getOrUndefined(input.model)
    if (model && !validModel(model))
      return yield* Effect.fail(new Error("Provide --model in the format provider/model."))
    const piped = process.stdin.isTTY ? undefined : (yield* Effect.promise(() => readStdin())).trim() || undefined
    if (piped && input.staged)
      return yield* Effect.fail(new Error("--staged cannot be used with a diff piped on stdin"))
    if (piped && Option.isSome(branch))
      return yield* Effect.fail(new Error("--branch cannot be used with a diff piped on stdin"))
    const patch = yield* Effect.gen(function* () {
      if (piped) return piped
      const git = yield* Git.make
      const root = yield* git.run(["rev-parse", "--show-toplevel"])
      if (root.exitCode !== 0)
        return yield* Effect.fail(
          new Error("Could not find git repository. Run from a git repository or pipe a diff on stdin."),
        )
      const cwd = root.stdout.toString().trim()
      const range = yield* Effect.gen(function* () {
        if (input.staged) return ["diff", "--cached"]
        if (Option.isNone(branch)) return ["diff", "HEAD"]
        const base = branch.value || (yield* git.defaultBranch(cwd))
        if (!base)
          return yield* Effect.fail(new Error("Could not determine the default branch. Pass one with --branch <name>."))
        const merge = yield* git.run(["merge-base", base, "HEAD"], cwd)
        if (merge.exitCode !== 0) return yield* Effect.fail(new Error(`Could not find a merge base with ${base}.`))
        return ["diff", `${merge.stdout.toString().trim()}..HEAD`]
      })
      const result = yield* git.run(range, cwd).pipe(Effect.flatMap(AppProcess.requireSuccess))
      const text = result.stdout.toString().trim()
      if (text && range[1].includes("..") && !input.json) {
        const signed = yield* git.run(["log", "--format=%h%x00%G?%x00%GS", range[1]], cwd)
        if (signed.exitCode === 0)
          for (const line of Signature.summary(Signature.parse(signed.stdout.toString())))
            process.stderr.write(line + "\n")
      }
      return text
    })
    if (!patch) {
      if (input.json) Envelope.print({ verdict: null, confidence: null, text: "" })
      else if (input.porcelain) Porcelain.print("verdict", "pass")
      else process.stdout.write("Nothing to review.\n")
      return
    }
    if (patch.length > 120_000)
      return yield* Effect.fail(new Error("The diff is too large to review in one shot. Review a narrower range."))
    if (!input.json && !input.porcelain) process.stderr.write("Reviewing changes...\n")
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
          title: "bolt review",
          agent: "code-review",
          model,
          text: `${INSTRUCTIONS}${input.confidence ? `\n${CONFIDENCE}` : ""}\n\nDiff:\n${patch}`,
        }),
      catch: (cause) => cause,
    })
    const outcome = verdict(text)
    if (input.json)
      Envelope.print({
        verdict: outcome ?? null,
        confidence: input.confidence ? (confidence(text) ?? null) : null,
        text,
      })
    else if (input.porcelain) {
      Porcelain.print("verdict", outcome ?? "unknown")
      if (input.confidence) Porcelain.print("confidence", confidence(text) ?? "unknown")
      Porcelain.print("text", text)
    } else {
      process.stdout.write(text + "\n")
      if (input.confidence)
        process.stderr.write(
          confidence(text)
            ? `Confidence: ${confidence(text)!.toUpperCase()}\n`
            : "Could not determine a confidence level from the review.\n",
        )
      if (!outcome) process.stderr.write("Could not determine a verdict from the review.\n")
    }
    if (outcome === "fail") process.exitCode = 1
    if (!outcome) process.exitCode = 2
  }).pipe(
    Effect.provide(LayerNode.compile(AppProcess.node)),
    Effect.catch((error) =>
      Effect.sync(() => {
        const message = errorMessage(error)
        if (input.json) Envelope.printError(error instanceof Error ? error.name : "Error", message)
        else process.stderr.write(message + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
