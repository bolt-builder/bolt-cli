import type { Argv } from "yargs"
import { Effect } from "effect"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { effectCmd, fail } from "../effect-cmd"

const LIMIT = 120_000

type Entry = {
  file: string
  section: string
  key: string
  text: string
  updatedAt?: number
}

type Digest = {
  id: string
  time: string
  topic?: string
  summary: string
}

/** Render stored memory entries and session digests as the evidence block for the why prompt. */
export function dossier(input: { entries: Entry[]; sessions: Digest[] }) {
  const entries = input.entries.map(
    (item) => `- [${item.file} > ${item.section} > ${item.key}]${stamp(item.updatedAt)} ${item.text}`,
  )
  const sessions = input.sessions.map(
    (item) => `- [session ${item.id}${item.topic ? ` > ${item.topic}` : ""}] learned ${item.time}: ${item.summary}`,
  )
  return [
    entries.length ? `## Memory entries\n${entries.join("\n")}` : "",
    sessions.length ? `## Session digests\n${sessions.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

function stamp(ms?: number) {
  if (!ms || ms <= 0) return ""
  return ` (updated ${new Date(ms).toISOString().slice(0, 10)})`
}

const INSTRUCTIONS = [
  "You are answering a question about this project's stored agent memory.",
  "Use only the memory dossier below as evidence. Do not use tools, read repository files, or invent memories.",
  "Answer the question, then cite the specific memory entries that support the answer: quote each supporting entry verbatim and name its file, section, and key.",
  "When an entry carries metadata such as an updated date or a session id, state where and when it was learned.",
  "If nothing in the dossier supports an answer, say plainly that stored memory does not cover it.",
].join("\n")

export const MemoryCommand = cmd({
  command: "memory",
  describe: "inspect project memory",
  builder: (yargs: Argv) => yargs.command(MemoryWhyCommand).command(MemoryTeamCommand).demandCommand(),
  async handler() {},
})

export const MemoryTeamCommand = effectCmd({
  command: "team <action> [query]",
  describe: "opt-in shared project memory committed to the repository",
  builder: (yargs) =>
    yargs
      .positional("action", {
        describe: "init creates .bolt/memory.md; share copies matching facts into it",
        type: "string",
        choices: ["init", "share"] as const,
        demandOption: true,
      })
      .positional("query", {
        describe: "key or id of the fact to share",
        type: "string",
      }),
  handler: Effect.fn("Cli.memory.team")(function* (args) {
    const { InstanceRef } = yield* Effect.promise(() => import("@/effect/instance-ref"))
    const ctx = yield* InstanceRef
    if (!ctx) return yield* fail("Could not load instance context")

    const { MemoryTeam } = yield* Effect.promise(() => import("@opencode-ai/memory/team"))
    if (args.action === "init") {
      const output = yield* Effect.promise(() => MemoryTeam.init(ctx.worktree))
      UI.println(
        output.created
          ? `Created ${output.file}. Commit it to share project memory with your team.`
          : `Team memory already exists at ${output.file}.`,
      )
      return
    }

    if (!args.query) return yield* fail("Pass the key or id of the fact to share.")
    const { MemoryFiles } = yield* Effect.promise(() => import("@opencode-ai/memory/store"))
    const { MemoryPaths } = yield* Effect.promise(() => import("@opencode-ai/memory/effect/paths"))
    const inventory = yield* Effect.promise(() => MemoryFiles.deriveInventory(MemoryPaths.root({ ctx })))
    const matched = MemoryTeam.match({
      items: Object.entries(inventory.items).map(([id, item]) => ({
        id,
        file: item.file,
        section: item.section,
        key: item.key,
        text: item.text,
      })),
      query: args.query,
    })
    if (matched.length === 0) return yield* fail(`No stored fact matches "${args.query}".`)
    const shared = yield* Effect.promise(() =>
      MemoryTeam.share(
        ctx.worktree,
        matched.map((item) => ({ section: item.section, key: item.key, text: item.text })),
      ),
    )
    UI.println(`Shared ${shared.count} fact${shared.count === 1 ? "" : "s"} into ${shared.file}.`)
    UI.println("Commit the file so teammates pick it up in recall.")
  }),
})

export const MemoryWhyCommand = effectCmd({
  command: "why <question>",
  describe: "ask why the agent believes something and where it learned it",
  builder: (yargs) =>
    yargs
      .positional("question", {
        describe: "what to ask stored memory about",
        type: "string",
        demandOption: true,
      })
      .option("model", {
        alias: "m",
        type: "string",
        describe: "model to use in the format of provider/model",
      }),
  handler: Effect.fn("Cli.memory.why")(function* (args) {
    const { InstanceRef } = yield* Effect.promise(() => import("@/effect/instance-ref"))
    const ctx = yield* InstanceRef
    if (!ctx) return yield* fail("Could not load instance context")

    const { MemoryService } = yield* Effect.promise(() => import("@opencode-ai/memory/effect/service"))
    const { MemoryPaths } = yield* Effect.promise(() => import("@opencode-ai/memory/effect/paths"))
    const memory = MemoryService.make()
    const shown = yield* memory.show({ ctx }).pipe(Effect.orDie)
    const digests = yield* memory.recent({ root: MemoryPaths.root({ ctx }), limit: 10, max: 200 }).pipe(Effect.orDie)
    const evidence = dossier({ entries: Object.values(shown.inventory.items), sessions: digests })
    if (!evidence) {
      return yield* fail("No project memory stored for this project yet. Run bolt learn or save memories first.")
    }

    UI.println("Asking stored memory...")

    const { Session } = yield* Effect.promise(() => import("@/session/session"))
    const { SessionPrompt } = yield* Effect.promise(() => import("@/session/prompt"))
    const { MessageID, PartID } = yield* Effect.promise(() => import("../../session/schema"))
    const { parseModel } = yield* Effect.promise(() => import("@/provider/provider"))
    const { extractResponseText } = yield* Effect.promise(() => import("./github.shared"))
    const sessions = yield* Session.Service
    const prompt = yield* SessionPrompt.Service
    const session = yield* sessions.create({
      title: "bolt memory why",
      permission: [
        { permission: "question", action: "deny", pattern: "*" },
        { permission: "plan_enter", action: "deny", pattern: "*" },
        { permission: "plan_exit", action: "deny", pattern: "*" },
      ],
    })

    const capped = evidence.length > LIMIT ? `${evidence.slice(0, LIMIT)}\n[dossier truncated]` : evidence
    const result = yield* prompt
      .prompt({
        sessionID: session.id,
        messageID: MessageID.ascending(),
        agent: "build",
        model: args.model ? parseModel(args.model) : undefined,
        parts: [
          {
            id: PartID.ascending(),
            type: "text",
            text: `${INSTRUCTIONS}\n\nQuestion:\n${args.question}\n\nMemory dossier:\n${capped}`,
          },
        ],
      })
      .pipe(Effect.orDie)

    if (result.info.role === "assistant" && result.info.error) {
      const err = result.info.error
      const message = "message" in err.data ? err.data.message : ""
      return yield* fail(`${err.name}: ${message}`)
    }

    const text = extractResponseText(result.parts) ?? ""
    if (!text) return yield* fail("The model returned an empty answer.")

    UI.empty()
    UI.println(UI.markdown(text))
  }),
})
