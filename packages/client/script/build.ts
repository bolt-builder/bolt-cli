import { NodeFileSystem } from "@effect/platform-node"
import { compile, emitEffectImported, emitEffectShape, emitPromise, write } from "@bolt-ai/httpapi-codegen"
import { ClientApi, effectOmitEndpoints, groupNames, promiseOmitEndpoints } from "@bolt-ai/protocol/client"
import { Agent } from "@bolt-ai/schema/agent"
import { Command } from "@bolt-ai/schema/command"
import { Config } from "@bolt-ai/schema/config"
import { Credential } from "@bolt-ai/schema/credential"
import { Event } from "@bolt-ai/schema/event"
import { EventLog } from "@bolt-ai/schema/event-log"
import { FileDiff } from "@bolt-ai/schema/file-diff"
import { FileSystem } from "@bolt-ai/schema/filesystem"
import { Form } from "@bolt-ai/schema/form"
import { Instruction } from "@bolt-ai/schema/instruction"
import { InstructionEntry } from "@bolt-ai/schema/instruction-entry"
import { Integration } from "@bolt-ai/schema/integration"
import { Location } from "@bolt-ai/schema/location"
import { Mcp } from "@bolt-ai/schema/mcp"
import { Model } from "@bolt-ai/schema/model"
import { Money } from "@bolt-ai/schema/money"
import { Permission } from "@bolt-ai/schema/permission"
import { PermissionSaved } from "@bolt-ai/schema/permission-saved"
import { Plugin } from "@bolt-ai/schema/plugin"
import { Project } from "@bolt-ai/schema/project"
import { Worktree } from "@bolt-ai/schema/worktree"
import { AgentAttachment, FileAttachment, Prompt, PromptMention } from "@bolt-ai/schema/prompt"
import { PromptInput } from "@bolt-ai/schema/prompt-input"
import { Provider } from "@bolt-ai/schema/provider"
import { Pty } from "@bolt-ai/schema/pty"
import { PtyTicket } from "@bolt-ai/schema/pty-ticket"
import { Question } from "@bolt-ai/schema/question"
import { Reference } from "@bolt-ai/schema/reference"
import { AbsolutePath, RelativePath } from "@bolt-ai/schema/schema"
import { Session } from "@bolt-ai/schema/session"
import { SessionMessage } from "@bolt-ai/schema/session-message"
import { SessionInbox } from "@bolt-ai/schema/session-inbox"
import { Shell } from "@bolt-ai/schema/shell"
import { Skill } from "@bolt-ai/schema/skill"
import { Snapshot } from "@bolt-ai/schema/snapshot"
import { UsageLimits } from "@bolt-ai/schema/usage-limits"
import { Vcs } from "@bolt-ai/schema/vcs"
import { WebSearch } from "@bolt-ai/schema/websearch"
import { Workspace } from "@bolt-ai/schema/workspace"
import { Effect, Schema } from "effect"
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
            "event.subscribe": {
              name: "OpenCodeEvent",
              import: 'import type { OpenCodeEvent } from "@bolt-ai/protocol/groups/event"',
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
