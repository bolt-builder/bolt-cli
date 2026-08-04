// CLI entry point for `bolt arena`: run the same task on several agents in
// parallel, each isolated in its own git worktree, then have a judge model
// rank the results. The winning worktree (and branch) is kept for review;
// --cleanup deletes the losers. Orchestration lives in ./run/arena.
import type { Argv } from "yargs"
import type { PermissionV1 } from "@opencode-ai/core/v1/permission"
import { Effect } from "effect"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { UI } from "../ui"
import { effectCmd } from "../effect-cmd"

export const ArenaCommand = effectCmd({
  command: "arena [message..]",
  describe: "race agents on the same task in isolated worktrees and keep the best result",
  builder: (yargs: Argv) =>
    yargs
      .positional("message", {
        describe: "task to send to every contender",
        type: "string",
        array: true,
        default: [],
      })
      .option("models", {
        type: "string",
        demandOption: true,
        describe: "comma-separated provider/model list (duplicates allowed, one worktree each)",
      })
      .option("judge", {
        type: "string",
        describe: "judge model as provider/model (defaults to the first entry in --models)",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use for every contender",
      })
      .option("variant", {
        type: "string",
        describe: "model variant (provider-specific reasoning effort, e.g., high, max, minimal)",
      })
      .option("format", {
        type: "string",
        choices: ["default", "json"],
        default: "default",
        describe: "format: default (formatted) or json (single JSON result)",
      })
      .option("cleanup", {
        type: "boolean",
        default: false,
        describe: "remove losing worktrees and their branches after judging",
      }),
  handler: Effect.fn("Cli.arena")(function* (args) {
    const { ServerAuth } = yield* Effect.promise(() => import("@/server/auth"))
    const { parseModels, runArena } = yield* Effect.promise(() => import("./run/arena"))
    yield* Effect.promise(async () => {
      function die(message: string): never {
        UI.error(message)
        process.exit(1)
      }

      const piped = process.stdin.isTTY ? undefined : await Bun.stdin.text()
      const message = [[...args.message, ...(args["--"] || [])].join(" "), piped?.trim() ?? ""]
        .filter(Boolean)
        .join("\n")
      if (message.trim().length === 0) die("You must provide a message")

      const models = parseModels(args.models)
      if (typeof models === "string") die(models)

      const judge = (() => {
        if (!args.judge) return models[0]
        const slash = args.judge.indexOf("/")
        if (slash <= 0 || slash === args.judge.length - 1) return die("--judge must be in provider/model format")
        const [providerID, ...rest] = args.judge.split("/")
        return { providerID, modelID: rest.join("/") } as (typeof models)[number]
      })()

      const rules: PermissionV1.Ruleset = [
        { permission: "question", action: "deny", pattern: "*" },
        { permission: "plan_enter", action: "deny", pattern: "*" },
        { permission: "plan_exit", action: "deny", pattern: "*" },
      ]

      const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const { Server } = await import("@/server/server")
        const request = new Request(input, init)
        const headers = new Headers(request.headers)
        const auth = ServerAuth.header()
        if (auth) headers.set("Authorization", auth)
        return Server.Default().app.fetch(new Request(request, { headers }))
      }) as typeof globalThis.fetch
      const client = (directory: string) =>
        createOpencodeClient({ baseUrl: "http://opencode.internal", fetch: fetchFn, directory })

      const exit = await runArena({
        sdk: client(process.cwd()),
        client,
        models,
        judge,
        message,
        parts: [{ type: "text", text: message }],
        agent: args.agent,
        variant: args.variant,
        permission: [...rules],
        json: args.format === "json",
        cleanup: args.cleanup,
      })
      if (exit) process.exitCode = exit
    })
  }),
})
