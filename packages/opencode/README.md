```
 /$$$$$$$   /$$$$$$  /$$    /$$$$$$$$        /$$$$$$  /$$       /$$$$$$
| $$__  $$ /$$__  $$| $$   |__  $$__/       /$$__  $$| $$      |_  $$_/
| $$  \ $$| $$  \ $$| $$      | $$         | $$  \__/| $$        | $$
| $$$$$$$ | $$  | $$| $$      | $$         | $$      | $$        | $$
| $$__  $$| $$  | $$| $$      | $$         | $$      | $$        | $$
| $$  \ $$| $$  | $$| $$      | $$         | $$    $$| $$        | $$
| $$$$$$$/|  $$$$$$/| $$$$$$$$| $$         |  $$$$$$/| $$$$$$$$ /$$$$$$
|_______/  \______/ |________/|__/          \______/ |________/|______/
```

# opencode

Terminal-based AI coding agent. Reads your codebase, understands what you're building, and ships code — all from the command line.

Built with [Effect](https://effect.website), [OpenTUI](https://github.com/opentui/opentui), and [SolidJS](https://www.solidjs.com).

## Install

```bash
# Quick install (macOS / Linux)
curl -fsSL https://raw.githubusercontent.com/Bolt-builder/bolt-cli/dev/install | bash

# npm / bun / pnpm / yarn
npm i -g opencode-ai@latest
```

## Quick start

```bash
# Open the TUI in the current directory
opencode

# Run a prompt directly (non-interactive)
opencode run "explain this codebase"

# Attach to an existing session
opencode attach

# Start a session with a specific agent
opencode run --agent ask "what does this project do?"
```

## CLI commands

| Command     | Description                                    |
| ----------- | ---------------------------------------------- |
| `opencode`  | Launch the interactive TUI                     |
| `run`       | Run a non-interactive prompt                   |
| `attach`    | Attach to a running session                    |
| `session`   | Manage sessions (list, tail, delete)           |
| `agent`     | List and configure agents                      |
| `providers` | Configure LLM providers                        |
| `models`    | List available models                          |
| `mcp`       | Manage MCP servers                             |
| `serve`     | Start the API server                           |
| `web`       | Start the web UI                               |
| `upgrade`   | Upgrade to the latest version                  |
| `uninstall` | Remove opencode                                |
| `generate`  | Generate shell completions                     |
| `export`    | Export session history                         |
| `import`    | Import session history                         |
| `plugin`    | Manage plugins                                 |
| `github`    | GitHub integration (PR, issues)                |
| `pr`        | Create PR from a session                       |
| `stats`     | Show usage statistics                          |
| `account`   | Manage accounts                                |
| `debug`     | Debug information                              |
| `db`        | Database operations                            |
| `acp`       | Agent-to-agent communication protocol commands |

## Configuration

Configuration lives in `.opencode/opencode.jsonc` in your project root (created on first run).

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    // Provider config goes here
  },
}
```

### Environment variables

| Variable              | Description                         |
| --------------------- | ----------------------------------- |
| `OPENCODE_LOG_LEVEL`  | Log level: DEBUG, INFO, WARN, ERROR |
| `OPENCODE_PRINT_LOGS` | Print logs to stderr                |
| `OPENCODE_PURE`       | Run without external plugins        |
| `OPENCODE_BIN_PATH`   | Override binary path                |

## Agents

Built-in agents. Switch with `Tab` in the TUI.

| Agent  | Access | Description                            |
| ------ | ------ | -------------------------------------- |
| `code` | Full   | Default — reads, writes, runs code     |
| `ask`  | Read   | Questions and research — no file edits |
| `plan` | Read   | Analysis — asks before bash commands   |

Use `@general` to invoke the subagent for complex multi-step tasks.

## Development

```bash
# Clone and build
git clone https://github.com/Bolt-builder/bolt-cli.git
cd bolt-cli
bun install

# Start the TUI in dev mode (from packages/opencode)
cd packages/opencode
bun dev

# Run tests
bun test

# Type-check
bun typecheck
```

### Project structure

```
src/
├── cli/          # CLI commands and UI
├── session/      # Session management and LLM integration
├── server/       # API server
├── agent/        # Agent system
├── config/       # Configuration modules
├── provider/     # LLM provider integrations
├── tool/         # Tool system
├── plugin/       # Plugin system
├── mcp/          # MCP server management
├── project/      # Project bootstrap
├── auth/         # Authentication
├── git/          # Git integration
├── image/        # Image handling
├── effect/       # Effect runtime utilities
├── storage/      # Database (Drizzle ORM)
├── sync/         # Sync engine
└── bus/          # Event bus
```

### Running the TUI headlessly

Use `tmux` to inspect the TUI output during development:

```bash
tmux new-session -d -s opencode-dev 'bun dev'
tmux capture-pane -pt opencode-dev
tmux kill-session -t opencode-dev
```

## License

MIT © [Bolt CLI](https://github.com/Bolt-builder/bolt-cli)

---

**Community**: [OpenCode Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
