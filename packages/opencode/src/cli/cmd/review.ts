import { Effect } from "effect"
import { UI } from "../ui"
import { effectCmd, fail } from "../effect-cmd"
import { Git } from "@/git"
import { InstanceRef } from "@/effect/instance-ref"
import { Session } from "@/session/session"
import { SessionPrompt } from "@/session/prompt"
import { MessageID, PartID } from "../../session/schema"
import { parseModel } from "@/provider/provider"
import { extractResponseText } from "./github.shared"

const LIMIT = 120_000

/** Parse the last pass/fail verdict marker from the review response. */
export function verdict(text: string) {
  const matches = [...text.matchAll(/verdict:\s*(pass|fail)/gi)]
  const last = matches.at(-1)
  if (!last) return undefined
  return last[1].toLowerCase() as "pass" | "fail"
}

const INSTRUCTIONS = [
  "Review the following code changes. Use the read, grep, and glob tools to inspect surrounding code when the diff alone is not enough.",
  "Report each issue with a severity (critical, major, minor), the file and line, and a short explanation. Be concise and do not restate the diff. If there are no issues, say so.",
  'End your final message with exactly one line: "Verdict: PASS" if there are no critical or major issues, otherwise "Verdict: FAIL".',
].join("\n")

export const ReviewCommand = effectCmd({
  command: "review",
  describe: "review code changes with the code-review agent",
  builder: (yargs) =>
    yargs
      .option("staged", {
        type: "boolean",
        describe: "review staged changes only",
        default: false,
      })
      .option("branch", {
        type: "string",
        describe: "review changes since the merge base with a branch (defaults to the default branch)",
      })
      .option("model", {
        alias: "m",
        type: "string",
        describe: "model to use in the format of provider/model",
      })
      .conflicts("staged", "branch"),
  handler: Effect.fn("Cli.review")(function* (args) {
    const ctx = yield* InstanceRef
    if (!ctx) return yield* fail("Could not load instance context")
    if (ctx.project.vcs !== "git") {
      return yield* fail("Could not find git repository. Please run this command from a git repository.")
    }

    const git = yield* Git.Service
    const cwd = ctx.worktree

    const range = yield* Effect.gen(function* () {
      if (args.staged) return ["diff", "--cached"]
      if (args.branch === undefined) return ["diff", "HEAD"]
      const base = yield* Effect.gen(function* () {
        if (args.branch) return args.branch
        const branch = yield* git.defaultBranch(cwd)
        if (!branch) return yield* fail("Could not determine the default branch. Pass one with --branch <name>.")
        return branch.ref
      })
      const merge = yield* git.mergeBase(cwd, base)
      if (!merge) return yield* fail(`Could not find a merge base with ${base}.`)
      return ["diff", `${merge}..HEAD`]
    })

    const diff = yield* git.run(range, { cwd })
    if (diff.exitCode !== 0) return yield* fail(diff.stderr.toString().trim() || "git diff failed")
    const patch = diff.text().trim()
    if (!patch) {
      UI.println("Nothing to review.")
      return
    }
    if (patch.length > LIMIT) {
      return yield* fail("The diff is too large to review in one shot. Review a narrower range.")
    }

    UI.println("Reviewing changes...")

    const sessions = yield* Session.Service
    const prompt = yield* SessionPrompt.Service
    const session = yield* sessions.create({
      title: "bolt review",
      permission: [{ permission: "question", action: "deny", pattern: "*" }],
    })

    const result = yield* prompt.prompt({
      sessionID: session.id,
      messageID: MessageID.ascending(),
      agent: "code-review",
      model: args.model ? parseModel(args.model) : undefined,
      parts: [{ id: PartID.ascending(), type: "text", text: `${INSTRUCTIONS}\n\nDiff:\n${patch}` }],
    }).pipe(Effect.orDie)

    if (result.info.role === "assistant" && result.info.error) {
      const err = result.info.error
      const message = "message" in err.data ? err.data.message : ""
      return yield* fail(`${err.name}: ${message}`)
    }

    const text = extractResponseText(result.parts) ?? ""
    if (!text) return yield* fail("The model returned an empty review.")

    UI.empty()
    UI.println(UI.markdown(text))
    UI.empty()

    const outcome = verdict(text)
    if (outcome === "pass") return
    if (outcome === "fail") {
      process.exitCode = 1
      return
    }
    UI.println("Could not determine a verdict from the review.")
    process.exitCode = 2
  }),
})
