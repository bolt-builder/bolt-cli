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
  builder: (yargs: Argv) =>
    yargs.command(MemoryWhyCommand).command(MemoryExportCommand).command(MemoryImportCommand).demandCommand(),
  async handler() {},
})

export const MemoryExportCommand = effectCmd({
  command: "export",
  describe: "export project memory as a single markdown document",
  builder: (yargs) =>
    yargs.option("out", {
      alias: "o",
      type: "string",
      describe: "write the export to a file instead of stdout",
    }),
  handler: Effect.fn("Cli.memory.export")(function* (args) {
    const { InstanceRef } = yield* Effect.promise(() => import("@/effect/instance-ref"))
    const ctx = yield* InstanceRef
    if (!ctx) return yield* fail("Could not load instance context")

    const { Memory } = yield* Effect.promise(() => import("@opencode-ai/memory/memory"))
    const { MemoryPaths } = yield* Effect.promise(() => import("@opencode-ai/memory/effect/paths"))
    const dumped = yield* Effect.promise(() => Memory.dump({ root: MemoryPaths.root({ ctx }) }))
    if (dumped.count === 0) return yield* fail("No project memory stored for this project yet.")
    if (!args.out) {
      UI.println(dumped.text)
      return
    }
    yield* Effect.promise(() => Bun.write(args.out!, dumped.text))
    UI.println(`Exported ${dumped.count} memory entries to ${args.out}`)
  }),
})

export const MemoryImportCommand = effectCmd({
  command: "import <file>",
  describe: "import memory entries from an exported markdown document",
  builder: (yargs) =>
    yargs.positional("file", {
      describe: "path to a markdown export produced by bolt memory export",
      type: "string",
      demandOption: true,
    }),
  handler: Effect.fn("Cli.memory.import")(function* (args) {
    const { InstanceRef } = yield* Effect.promise(() => import("@/effect/instance-ref"))
    const ctx = yield* InstanceRef
    if (!ctx) return yield* fail("Could not load instance context")

    const exists = yield* Effect.promise(() => Bun.file(args.file).exists())
    if (!exists) return yield* fail(`File not found: ${args.file}`)
    const text = yield* Effect.promise(() => Bun.file(args.file).text())

    const { Memory } = yield* Effect.promise(() => import("@opencode-ai/memory/memory"))
    const { MemoryPaths } = yield* Effect.promise(() => import("@opencode-ai/memory/effect/paths"))
    const loaded = yield* Effect.promise(() => Memory.load({ root: MemoryPaths.root({ ctx }), text }))
    if (loaded.ops === 0) return yield* fail("No memory entries found in that file.")
    UI.println(`Imported ${loaded.applied} of ${loaded.ops} memory entries (${loaded.added} added).`)
    for (const name of loaded.skipped) {
      UI.println(`Skipped unknown memory file: ${name}`)
    }
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
