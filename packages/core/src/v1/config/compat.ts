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
  commands: Schema.optional(Schema.Boolean).annotate({
    description:
      "Import custom commands and workflows from other coding agents (.claude/commands, .cursor/commands, .roo/commands, .kilocode/workflows, .windsurf/workflows, ~/.codex/prompts). Defaults to true.",
  }),
  agents: Schema.optional(Schema.Boolean).annotate({
    description:
      "Import custom modes from Roo Code and Kilo Code (.roomodes, .kilocodemodes) as agents. Defaults to true.",
  }),
}).annotate({ identifier: "CompatConfig" })
export type Info = Schema.Schema.Type<typeof Info>
