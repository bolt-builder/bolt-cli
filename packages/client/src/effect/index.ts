// TODO: Keep additional network capabilities inside Schema and Protocol as the client grows; /effect must never import
// Core or Server. Preserve these datatype exports so internal model reorganizations do not require caller migrations.
import type { Effect } from "effect"
import type { OpenCode } from "./client.js"

export * from "./generated/index"
export { OpenCode } from "./client.js"
export type {
  AgentApi,
  AppApi,
  CommandApi,
  ConfigApi,
  EventApi,
  IntegrationApi,
  ModelApi,
  PluginApi,
  ProviderApi,
  ReferenceApi,
  RpcApi,
  RpcClient,
  WebSearchApi,
  SessionApi,
  SkillApi,
} from "./api.js"
export { Agent } from "@bolt-ai/schema/agent"
export { Command } from "@bolt-ai/schema/command"
export { Config } from "@bolt-ai/schema/config"
export { Credential } from "@bolt-ai/schema/credential"
export { Event } from "@bolt-ai/schema/event"
export { EventLog } from "@bolt-ai/schema/event-log"
export { FileSystem } from "@bolt-ai/schema/filesystem"
export { Form } from "@bolt-ai/schema/form"
export { Integration } from "@bolt-ai/schema/integration"
export { Location } from "@bolt-ai/schema/location"
export { Model } from "@bolt-ai/schema/model"
export { Permission } from "@bolt-ai/schema/permission"
export { PermissionSaved } from "@bolt-ai/schema/permission-saved"
export { Project } from "@bolt-ai/schema/project"
export { Worktree } from "@bolt-ai/schema/worktree"
export { Vcs } from "@bolt-ai/schema/vcs"
export { Provider } from "@bolt-ai/schema/provider"
export { Pty } from "@bolt-ai/schema/pty"
export { Question } from "@bolt-ai/schema/question"
export { Reference } from "@bolt-ai/schema/reference"
export { WebSearch } from "@bolt-ai/schema/websearch"
export { AbsolutePath, RelativePath } from "@bolt-ai/schema/schema"
export { Session } from "@bolt-ai/schema/session"
export { SessionInbox } from "@bolt-ai/schema/session-inbox"
export { SessionMessage } from "@bolt-ai/schema/session-message"
export { Skill } from "@bolt-ai/schema/skill"
export { Prompt } from "@bolt-ai/schema/prompt"
export { PromptInput } from "@bolt-ai/schema/prompt-input"
export type { OpenCodeEvent } from "@bolt-ai/protocol/groups/event"
export type OpenCodeClient = Effect.Success<ReturnType<typeof OpenCode.make>>
