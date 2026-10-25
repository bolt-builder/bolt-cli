import { NodeFileSystem } from "@effect/platform-node"
import { compile, emitEffectImported, emitPromise, write } from "@bolt-ai/httpapi-codegen"
import { ClientApi, endpointNames, groupNames, omitEndpoints } from "../src/contract"
import { Effect } from "effect"
import { fileURLToPath } from "url"

const promiseContract = compile(ClientApi, { groupNames, omitEndpoints: promiseOmitEndpoints })
const effectContract = compile(ClientApi, { groupNames, omitEndpoints: effectOmitEndpoints })
const effectTypeReferences = [
  ...namespaceTypes("Agent", "@bolt-ai/schema/agent", Agent),
  ...namespaceTypes("Command", "@bolt-ai/schema/command", Command),
  ...namespaceTypes("Config", "@bolt-ai/schema/config", Config),
  ...namespaceTypes("Credential", "@bolt-ai/schema/credential", Credential),
  ...namespaceTypes("Event", "@bolt-ai/schema/event", Event),
  ...namespaceTypes("EventLog", "@bolt-ai/schema/event-log", EventLog),
  ...namespaceTypes("FileDiff", "@bolt-ai/schema/file-diff", FileDiff),
  ...namespaceTypes("FileSystem", "@bolt-ai/schema/filesystem", FileSystem),
  ...namespaceTypes("Form", "@bolt-ai/schema/form", Form),
  ...namespaceTypes("Instruction", "@bolt-ai/schema/instruction", Instruction),
  ...namespaceTypes("InstructionEntry", "@bolt-ai/schema/instruction-entry", InstructionEntry),
  ...namespaceTypes("Integration", "@bolt-ai/schema/integration", Integration),
  typeReference("Location.PublicRef", "@bolt-ai/schema/location", Location.PublicRef),
  typeReference("Location.PublicInfo", "@bolt-ai/schema/location", Location.PublicInfo),
  ...namespaceTypes("Mcp", "@bolt-ai/schema/mcp", Mcp),
  ...namespaceTypes("Model", "@bolt-ai/schema/model", Model),
  ...namespaceTypes("Money", "@bolt-ai/schema/money", Money),
  ...namespaceTypes("Permission", "@bolt-ai/schema/permission", Permission),
  ...namespaceTypes("PermissionSaved", "@bolt-ai/schema/permission-saved", PermissionSaved),
  ...namespaceTypes("Plugin", "@bolt-ai/schema/plugin", Plugin),
  ...namespaceTypes("Project", "@bolt-ai/schema/project", Project),
  ...namespaceTypes("Worktree", "@bolt-ai/schema/worktree", Worktree),
  ...namespaceTypes("PromptInput", "@bolt-ai/schema/prompt-input", PromptInput),
  ...namespaceTypes("Provider", "@bolt-ai/schema/provider", Provider),
  ...namespaceTypes("Pty", "@bolt-ai/schema/pty", Pty),
  ...namespaceTypes("PtyTicket", "@bolt-ai/schema/pty-ticket", PtyTicket),
  ...namespaceTypes("Question", "@bolt-ai/schema/question", Question),
  ...namespaceTypes("Reference", "@bolt-ai/schema/reference", Reference),
  ...namespaceTypes("Session", "@bolt-ai/schema/session", Session),
  ...namespaceTypes("SessionMessage", "@bolt-ai/schema/session-message", SessionMessage),
  ...namespaceTypes("SessionInbox", "@bolt-ai/schema/session-inbox", SessionInbox),
  ...namespaceTypes("Shell", "@bolt-ai/schema/shell", Shell),
  ...namespaceTypes("Skill", "@bolt-ai/schema/skill", Skill),
  ...namespaceTypes("Snapshot", "@bolt-ai/schema/snapshot", Snapshot),
  ...namespaceTypes("UsageLimits", "@bolt-ai/schema/usage-limits", UsageLimits),
  ...namespaceTypes("Vcs", "@bolt-ai/schema/vcs", Vcs),
  ...namespaceTypes("WebSearch", "@bolt-ai/schema/websearch", WebSearch),
  ...namespaceTypes("Workspace", "@bolt-ai/schema/workspace", Workspace),
  typeReference("Prompt", "@bolt-ai/schema/prompt", Prompt),
  typeReference("PromptMention", "@bolt-ai/schema/prompt", PromptMention),
  typeReference("FileAttachment", "@bolt-ai/schema/prompt", FileAttachment),
  typeReference("AgentAttachment", "@bolt-ai/schema/prompt", AgentAttachment),
  typeReference("AbsolutePath", "@bolt-ai/schema/schema", AbsolutePath),
  typeReference("RelativePath", "@bolt-ai/schema/schema", RelativePath),
]

await Effect.runPromise(
  Effect.all(
    [
      write(
        emitPromise(promiseContract, {
          mutableOutputs: true,
        }),
        fileURLToPath(new URL("../src/promise/generated", import.meta.url)),
      ),
      write(
        emitEffectImported(effectContract, {
          module: "../../contract",
          api: "ClientApi",
          shapeModule: "../api/api.js",
        }),
        fileURLToPath(new URL("../src/effect/generated", import.meta.url)),
      ),
      write(
        emitEffectShape(effectContract, {
          typeReferences: effectTypeReferences,
          outputTypes: {
            "events.subscribe": {
              name: "BoltEventEncoded",
              import: 'import type { BoltEventEncoded } from "@bolt-ai/protocol/groups/event"',
            },
          },
        }),
        fileURLToPath(new URL("../src/effect/api", import.meta.url)),
      ),
    ],
    { concurrency: 3, discard: true },
  ).pipe(Effect.provide(NodeFileSystem.layer)),
)

function namespaceTypes(namespace: string, module: string, values: object) {
  return Object.entries(values).flatMap(([name, schema]) =>
    Schema.isSchema(schema) ? [typeReference(`${namespace}.${name}`, module, schema)] : [],
  )
}

function typeReference(name: string, module: string, schema: Schema.Top) {
  return {
    schema,
    name,
    import: `import type { ${name.split(".")[0]} } from ${JSON.stringify(module)}`,
  }
}
