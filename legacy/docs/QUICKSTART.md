# Bolt Quickstart

Get from zero to your first useful result in about five minutes.

## 1. Install

Pick one:

```bash
# Quick install (macOS / Linux)
curl -fsSL https://raw.githubusercontent.com/bolt-builder/bolt-cli/dev/install | bash

# npm / bun / pnpm / yarn
npm i -g @bolt-builder/bolt-cli

# Homebrew (macOS / Linux)
brew install bolt-builder/tap/bolt-cli

# Try it without installing
npx @bolt-builder/bolt-cli
```

Check it worked:

```bash
bolt --version
```

## 2. Connect a model provider

Bolt needs credentials for at least one LLM provider.

```bash
bolt providers login     # log in to a provider
bolt providers list      # see what's connected
bolt models              # see which models you can use
```

## 3. Open Bolt in a project

```bash
cd your-project
bolt
```

This launches the interactive TUI. Bolt reads your project context automatically, and creates `.bolt/bolt.jsonc` on first run.

Type a request and press Enter, for example:

> explain how authentication works in this repo

### Handy keys in the TUI

| Key      | What it does                                                                     |
| -------- | -------------------------------------------------------------------------------- |
| `Tab`    | Switch agent                                                                     |
| `Ctrl+P` | Command palette (toggle settings like the fire animation, switch themes, models) |

## 4. Pick the right agent

Press `Tab` to switch, or choose one up front with `--agent`.

| Agent          | Use it when you want to...                        |
| -------------- | ------------------------------------------------- |
| `code`         | Read, write, and run code (default)               |
| `plan`         | Get a plan without any files being changed        |
| `ask`          | Ask questions safely, read-only                   |
| `debug`        | Chase down a failing test or crash                |
| `refactor`     | Restructure code with tests checked at every step |
| `code-review`  | Review changes for bugs, style, and security      |
| `orchestrator` | Coordinate a big multi-step job across agents     |

Not sure which one? Let Bolt choose:

```bash
bolt run --agent auto "fix the failing checkout test"
```

## 5. Use it from scripts (no TUI)

```bash
# One-shot prompt
bolt run "explain this codebase"

# Pipe-friendly Q&A: answer goes to stdout, nothing else
cat error.log | bolt ask "why is this failing"

# Attach a file
bolt run -f src/server.ts "find bugs in this file"

# Machine-readable output for scripting
bolt run --json "list the public API of this package"

# Continue where you left off
bolt run --continue "now add tests for it"
```

## 6. Everyday workflows

```bash
bolt commit            # commit staged changes with a generated message
bolt review            # AI review of a diff, with pass/fail exit codes (handy in CI)
bolt pr <number>       # check out a GitHub PR into a local branch
bolt stats             # token usage and cost so far
```

## 7. Sessions you can leave and come back to

Your work is stored locally and never lost when you close the terminal.

```bash
bolt session list                         # see past sessions
bolt run --continue "keep going"          # resume the last one
bolt run --session <id> --fork "try another approach"   # branch a session
bolt export                               # export a transcript (add --sanitize to scrub it)
bolt import <file-or-share-url>           # bring one in
```

## 8. Go further

- **Remote:** `bolt serve` starts a headless server, and `bolt attach <url>` connects to it from anywhere.
- **MCP servers:** `bolt mcp add` to plug in extra tools, with OAuth handled for you.
- **Custom agents:** `bolt agent create`, or drop a markdown file in `.bolt/agent/`.
- **Desktop app:** download it from the [releases page](https://github.com/Bolt-builder/bolt-cli/releases).
- **Full command reference:** [docs/reference](./reference/README.md)

## Troubleshooting

| Problem                     | Try                                                                 |
| --------------------------- | ------------------------------------------------------------------- |
| Something is behaving oddly | `BOLT_PRINT_LOGS=1 BOLT_LOG_LEVEL=DEBUG bolt` to see logs on stderr |
| A plugin is causing trouble | `BOLT_PURE=1 bolt` runs without external plugins                    |
| Network is flaky            | `bolt run --offline ...` fails fast instead of hanging              |
| Need to inspect your data   | `bolt db` queries the local session database                        |
| Want help with any command  | `bolt <command> --help`                                             |

Questions or ideas? Join the [Discussions](https://github.com/Bolt-builder/bolt-cli/discussions).
