export * as ConfigCompatV1 from "./compat"

import { Schema } from "effect"

export const Info = Schema.Struct({
  rules: Schema.optional(Schema.Boolean).annotate({
    description:
      "Import rules files written for other coding agents (Cursor, Windsurf, Cline, Roo, Kilo, Kiro, Continue, Copilot, Gemini, and others). Defaults to true.",
  }),
  mcp: Schema.optional(Schema.Boolean).annotate({
    description:
      "Import MCP server definitions from other coding agents' config files (.mcp.json, .cursor/mcp.json, .vscode/mcp.json, ~/.codex/config.toml, and others). Defaults to false because imported servers execute commands defined in repository files.",
  }),
}).annotate({ identifier: "CompatConfig" })
export type Info = Schema.Schema.Type<typeof Info>
