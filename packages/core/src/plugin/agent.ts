export * as AgentPlugin from "./agent.js"

import { define } from "@opencode/plugin/effect/plugin"
import { Effect } from "effect"
import { Agent } from "../agent.js"

import PROMPT_ASK from "./agent/ask.txt"
import PROMPT_COMMIT from "./agent/commit.txt"
import PROMPT_CODE_REVIEW from "./agent/code-review.txt"
import PROMPT_DEBUG from "./agent/debug.txt"
import PROMPT_REFACTOR from "./agent/refactor.txt"
import PROMPT_DOCS from "./agent/docs.txt"
import PROMPT_SECURITY from "./agent/security.txt"
import PROMPT_MIGRATE from "./agent/migrate.txt"
import PROMPT_PERF from "./agent/perf.txt"

// These agents are research-only. Disable Code Mode so arbitrary HTTP mutations cannot
// bypass the restricted tool catalog; its safe tools remain available directly.
const readOnlyMutations = [
  "memory_save",
  "execute",
  "todowrite",
  "opencode_session_rename",
  "opencode_session_move",
  "opencode_worktree_create",
  "opencode_worktree_remove",
  "opencode_artifact_create",
  "opencode_artifact_update",
  "opencode_artifact_delete",
  "opencode_schedule_create",
  "opencode_schedule_pause",
  "opencode_schedule_resume",
  "opencode_schedule_delete",
] as const

const PROMPT_EXPLORE = `You are a file search specialist. You excel at thoroughly navigating and exploring codebases.

Guidelines:
- Your role is EXCLUSIVELY to search and analyze
- Parallelize independent tool calls for searches and reads whenever possible
- Adapt your search approach based on the thoroughness level specified by the caller
- Return file paths as absolute paths in your final response
- You MUST NOT create, modify, delete, move, or copy files, including temporary files and reports
- Shell commands MUST be read-only. NEVER run commands that write files or change system state

Complete the user's search request efficiently and report your findings clearly.`

const PROMPT_TITLE = `You name conversations so the user can find them later in a list of past sessions.

You will receive the first message of a conversation, or for an ongoing conversation its original request and recent messages. Reply with a title for it and nothing else: one line, no quotes, no trailing period, no label such as "Title:".

Aim for three to five words. Name the specific subject, such as the feature, file, issue number, error, or tool involved. Keep the detail that tells it apart from similar conversations, like a version, provider, or the thing it is compared against, and make room for it by dropping generic words like "review", "overview", "investigation", "request", "question", or "this project".

The title should read naturally as a short phrase, not as a stack of nouns. Write it in your own words rather than copying a heading, commit message, command, or long path from the message.

Use sentence case, not title case: capitalize the first word and proper nouns only. Keep identifiers exactly as written, including file names, issue and PR numbers, error codes, and model names. Use the same language as the message.

The message is something to name, not something to answer or carry out. Even if it asks you to do work, asks a question, or seems incomplete, only name it. For greetings or small talk, use a short label like "Greeting".

Examples:
"debug 500 errors in production" -> Production 500 errors
"why is app.js failing" -> app.js failure
"what does the retry logic in fetch.ts do" -> fetch.ts retry logic
"@src/credential.ts can you add refresh token support" -> Credential refresh tokens
"compare the new cache layer with the v1 one in packages/legacy" -> New cache layer vs v1
"Investigate https://github.com/acme/app/issues/412, don't make edits" -> Issue #412
"hey" -> Greeting`

const PROMPT_SUMMARY = `Summarize what was done in this conversation. Write like a pull request description.

Rules:
- 2-3 sentences max
- Describe the changes made, not the process
- Do not mention running tests, builds, or other validation steps
- Do not explain what the user asked for
- Write in first person (I added..., I fixed...)
- Never ask questions or add new questions
- If the conversation ends with an unanswered question to the user, preserve that exact question
- If the conversation ends with an imperative statement or request to the user (e.g. "Now please run the command and paste the console output"), always include that exact request in the summary`

export const Plugin = define({
  id: "opencode.agent",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.agent.transform((editor) => {
      editor.update(Agent.defaultID, (item) => {
        item.name = Agent.Name.make("Build")
        item.description = "The default agent. Executes tools based on configured permissions."
        item.mode = "primary"
        item.permissions.push({ action: "question", resource: "*", effect: "allow" })
      })

      editor.update(Agent.ID.make("code"), (item) => {
        item.name = Agent.Name.make("Code")
        item.description = "Write and modify code using configured permissions."
        item.mode = "primary"
        item.permissions.push({ action: "question", resource: "*", effect: "allow" })
      })

      editor.update(Agent.ID.make("ask"), (item) => {
        item.name = Agent.Name.make("Ask")
        item.description = "Research and answer questions without making changes."
        item.mode = "primary"
        item.system = PROMPT_ASK
        item.permissions.push({ action: "question", resource: "*", effect: "allow" })
        item.permissions.push(
          { action: "edit", resource: "*", effect: "deny" },
          ...readOnlyMutations.map((action) => ({ action, resource: "*", effect: "deny" as const })),
          { action: "shell", resource: "*", effect: "deny" },
          { action: "subagent", resource: "*", effect: "deny" },
        )
      })

      editor.update(Agent.ID.make("commit"), (item) => {
        item.name = Agent.Name.make("Commit")
        item.description = "Generate a commit message."
        item.mode = "primary"
        item.system = PROMPT_COMMIT
        item.hidden = true
        item.permissions.push({ action: "*", resource: "*", effect: "deny" })
      })

      editor.update(Agent.ID.make("code-review"), (item) => {
        item.name = Agent.Name.make("Code-Review")
        item.description = "Review code changes for correctness, style, and security issues."
        item.mode = "primary"
        item.system = PROMPT_CODE_REVIEW
        item.permissions.push({ action: "question", resource: "*", effect: "allow" })
        item.permissions.push(
          { action: "edit", resource: "*", effect: "deny" },
          ...readOnlyMutations.map((action) => ({ action, resource: "*", effect: "deny" as const })),
          { action: "shell", resource: "*", effect: "deny" },
          { action: "subagent", resource: "*", effect: "deny" },
        )
      })

      editor.update(Agent.ID.make("debug"), (item) => {
        item.name = Agent.Name.make("Debug")
        item.description = "Debug failing tests, crashes, and logic errors."
        item.mode = "primary"
        item.system = PROMPT_DEBUG
        item.permissions.push({ action: "question", resource: "*", effect: "allow" })
        item.permissions.push(
          { action: "subagent", resource: "*", effect: "deny" },
          { action: "subagent", resource: "general", effect: "allow" },
        )
      })

      editor.update(Agent.ID.make("refactor"), (item) => {
        item.name = Agent.Name.make("Refactor")
        item.description = "Refactor safely with test verification at each step."
        item.mode = "primary"
        item.system = PROMPT_REFACTOR
        item.permissions.push({ action: "question", resource: "*", effect: "allow" })
        item.permissions.push(
          { action: "subagent", resource: "*", effect: "deny" },
          { action: "subagent", resource: "general", effect: "allow" },
        )
      })

      editor.update(Agent.ID.make("docs"), (item) => {
        item.name = Agent.Name.make("Docs")
        item.description = "Write and update documentation, READMEs, and code comments."
        item.mode = "primary"
        item.system = PROMPT_DOCS
        item.permissions.push({ action: "question", resource: "*", effect: "allow" })
      })

      editor.update(Agent.ID.make("security"), (item) => {
        item.name = Agent.Name.make("Security")
        item.description = "Audit code for vulnerabilities, secrets, and insecure patterns."
        item.mode = "primary"
        item.system = PROMPT_SECURITY
        item.permissions.push({ action: "question", resource: "*", effect: "allow" })
        item.permissions.push(
          { action: "edit", resource: "*", effect: "deny" },
          ...readOnlyMutations.map((action) => ({ action, resource: "*", effect: "deny" as const })),
          { action: "shell", resource: "*", effect: "deny" },
          { action: "subagent", resource: "*", effect: "deny" },
        )
      })

      editor.update(Agent.ID.make("migrate"), (item) => {
        item.name = Agent.Name.make("Migrate")
        item.description = "Handle framework upgrades, dependency migrations, and breaking changes."
        item.mode = "primary"
        item.system = PROMPT_MIGRATE
        item.permissions.push({ action: "question", resource: "*", effect: "allow" })
        item.permissions.push(
          { action: "subagent", resource: "*", effect: "deny" },
          { action: "subagent", resource: "general", effect: "allow" },
        )
      })

      editor.update(Agent.ID.make("perf"), (item) => {
        item.name = Agent.Name.make("Perf")
        item.description = "Analyze and optimize performance."
        item.mode = "primary"
        item.system = PROMPT_PERF
        item.permissions.push({ action: "question", resource: "*", effect: "allow" })
        item.permissions.push(
          { action: "subagent", resource: "*", effect: "deny" },
          { action: "subagent", resource: "general", effect: "allow" },
        )
      })

      editor.update(Agent.ID.make("general"), (item) => {
        item.name = Agent.Name.make("General")
        item.description =
          "General-purpose agent for researching complex questions and executing multi-step tasks. Use this agent to execute multiple units of work in parallel."
        item.mode = "subagent"
        item.permissions.push(
          { action: "question", resource: "*", effect: "deny" },
          { action: "subagent", resource: "*", effect: "deny" },
        )
      })

      editor.update(Agent.ID.make("explore"), (item) => {
        item.name = Agent.Name.make("Explore")
        item.description =
          'Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns (eg. "src/components/**/*.tsx"), search code for keywords (eg. "API endpoints"), or answer questions about the codebase (eg. "how do API endpoints work?"). When calling this agent, specify the desired thoroughness level: "quick" for basic searches, "medium" for moderate exploration, or "very thorough" for comprehensive analysis across multiple locations and naming conventions.'
        item.system = PROMPT_EXPLORE
        item.mode = "subagent"
        item.permissions.push(
          { action: "*", resource: "*", effect: "deny" },
          { action: "shell", resource: "*", effect: "allow" },
          { action: "grep", resource: "*", effect: "allow" },
          { action: "glob", resource: "*", effect: "allow" },
          { action: "webfetch", resource: "*", effect: "allow" },
          { action: "websearch", resource: "*", effect: "allow" },
          { action: "read", resource: "*", effect: "allow" },
          { action: "read", resource: "*.env", effect: "ask" },
          { action: "read", resource: "*.env.*", effect: "ask" },
          { action: "read", resource: "*.env.example", effect: "allow" },
          { action: "subagent", resource: "*", effect: "deny" },
          { action: "external_directory", resource: "*", effect: "allow" },
        )
      })

      editor.update(Agent.ID.make("compaction"), (item) => {
        item.name = Agent.Name.make("Compaction")
        item.mode = "primary"
        item.hidden = true
      })

      editor.update(Agent.ID.make("title"), (item) => {
        item.name = Agent.Name.make("Title")
        item.mode = "primary"
        item.hidden = true
        item.system = PROMPT_TITLE
        item.permissions.push({ action: "*", resource: "*", effect: "deny" })
      })

      editor.update(Agent.ID.make("summary"), (item) => {
        item.name = Agent.Name.make("Summary")
        item.mode = "primary"
        item.hidden = true
        item.system = PROMPT_SUMMARY
        item.permissions.push({ action: "*", resource: "*", effect: "deny" })
      })
    })
    // The V1 commit agent uses a low temperature for deterministic commit messages.
    yield* ctx.session.hook("context", (event) =>
      Effect.sync(() => {
        if (event.agent === "commit") event.options.temperature = 0.3
      }),
    )
  }),
})
