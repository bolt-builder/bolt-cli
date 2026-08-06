import { Effect } from "effect"
import { UI } from "../ui"
import { effectCmd, fail } from "../effect-cmd"

const LIMIT = 20_000

/** Keep the tail of test output so the most recent failures survive the cap. */
export function tail(output: string, limit = LIMIT) {
  const trimmed = output.trim()
  if (trimmed.length <= limit) return trimmed
  return `[output truncated]\n${trimmed.slice(-limit)}`
}

export const RefactorCommand = effectCmd({
  command: "refactor <instruction>",
  describe: "refactor with a test-verified loop: change, run, verify, repeat until green",
  builder: (yargs) =>
    yargs
      .positional("instruction", {
        describe: "refactor instruction for the agent",
        type: "string",
        demandOption: true,
      })
      .option("test", {
        type: "string",
        describe: "test command that must exit 0 for the refactor to count as done",
        demandOption: true,
      })
      .option("attempts", {
        type: "number",
        describe: "maximum number of test-and-fix iterations",
        default: 5,
      })
      .option("model", {
        alias: "m",
        type: "string",
        describe: "model to use in the format of provider/model",
      }),
  handler: Effect.fn("Cli.refactor")(function* (args) {
    const { InstanceRef } = yield* Effect.promise(() => import("@/effect/instance-ref"))
    const ctx = yield* InstanceRef
    if (!ctx) return yield* fail("Could not load instance context")

    const attempts = Math.max(1, Math.floor(args.attempts))
    const { Session } = yield* Effect.promise(() => import("@/session/session"))
    const { SessionPrompt } = yield* Effect.promise(() => import("@/session/prompt"))
    const { MessageID, PartID } = yield* Effect.promise(() => import("../../session/schema"))
    const { parseModel } = yield* Effect.promise(() => import("@/provider/provider"))
    const { extractResponseText } = yield* Effect.promise(() => import("./github.shared"))
    const sessions = yield* Session.Service
    const prompt = yield* SessionPrompt.Service
    const session = yield* sessions.create({
      title: "bolt refactor",
      permission: [
        { permission: "question", action: "deny", pattern: "*" },
        { permission: "plan_enter", action: "deny", pattern: "*" },
        { permission: "plan_exit", action: "deny", pattern: "*" },
      ],
    })

    const send = Effect.fn(function* (text: string) {
      const result = yield* prompt
        .prompt({
          sessionID: session.id,
          messageID: MessageID.ascending(),
          model: args.model ? parseModel(args.model) : undefined,
          parts: [{ id: PartID.ascending(), type: "text", text }],
        })
        .pipe(Effect.orDie)
      if (result.info.role === "assistant" && result.info.error) {
        const err = result.info.error
        const message = "message" in err.data ? err.data.message : ""
        return yield* fail(`${err.name}: ${message}`)
      }
      return extractResponseText(result.parts) ?? ""
    })

    // Run the test command through a shell so pipes, && chains, and quoting work as typed.
    const test = Effect.promise(async () => {
      const shell = process.platform === "win32" ? ["cmd", "/c", args.test] : ["sh", "-c", args.test]
      const proc = Bun.spawn(shell, { cwd: ctx.worktree, stdout: "pipe", stderr: "pipe" })
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exit = await proc.exited
      return { exit, output: `${stdout}\n${stderr}` }
    })

    UI.println("Refactoring...")
    yield* send(args.instruction)

    for (let attempt = 1; attempt <= attempts; attempt++) {
      UI.println(`Running tests (attempt ${attempt}/${attempts}): ${args.test}`)
      const run = yield* test
      if (run.exit === 0) {
        UI.println("Tests are green. Refactor complete.")
        return
      }
      if (attempt === attempts) break
      UI.println(`Tests failed with exit code ${run.exit}. Asking the agent to fix...`)
      yield* send(
        [
          `The test command \`${args.test}\` failed with exit code ${run.exit} after your changes.`,
          "Fix the failures and keep the refactor intact. Output (tail):",
          "",
          tail(run.output),
        ].join("\n"),
      )
    }

    return yield* fail(`Tests still failing after ${attempts} attempt${attempts === 1 ? "" : "s"}.`)
  }),
})
