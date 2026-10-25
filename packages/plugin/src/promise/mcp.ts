import type { McpApi } from "@bolt-ai/client/promise/api"
import type { Mcp } from "@bolt-ai/schema/mcp"
import type { Types } from "effect"
import type { Transform } from "./registration.js"

export interface MCPEditor {
  list(): readonly [string, Types.DeepMutable<Mcp.ServerConfig>][]
  get(name: string): Types.DeepMutable<Mcp.ServerConfig> | undefined
  set(name: string, config: Mcp.ServerConfig): void
  update(name: string, update: (config: Types.DeepMutable<Mcp.ServerConfig>) => void): void
  remove(name: string): void
}

export interface MCPDomain extends Pick<McpApi, "list"> {
  readonly transform: Transform<MCPEditor>
  readonly reload: () => Promise<void>
}
