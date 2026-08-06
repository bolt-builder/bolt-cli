<p align="center">
  <a href="https://github.com/Bolt-builder/bolt-cli">
    <img width="576" height="186" alt="image" src="https://github.com/user-attachments/assets/05ada17d-5f43-4ed8-9696-3fc84e46f066" />
  </a>
</p>

<p align="center">Your terminal, now with a full AI engineering team inside it.</p>

<p align="center">
  <a href="https://github.com/Bolt-builder/bolt-cli/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/Bolt-builder/bolt-cli/publish.yml?style=flat-square&branch=dev" /></a>
  <a href="https://www.npmjs.com/package/@bolt-builder/bolt-cli"><img alt="npm" src="https://img.shields.io/npm/v/@bolt-builder/bolt-cli?style=flat-square" /></a>
  <a href="https://github.com/Bolt-builder/bolt-cli"><img alt="GitHub stars" src="https://img.shields.io/github/stars/Bolt-builder/bolt-cli?style=flat-square" /></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square" /></a>
</p>
<p align="center">
  <a href="https://www.producthunt.com/products/bolt-cli?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-bolt-cli" target="_blank" rel="noopener noreferrer"><img alt="Bolt cli - Your terminal, now with a full AI engineering team inside it. | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1211272&theme=light&t=1785541043666" /></a>
</p>

<p align="center">
<img width="640" height="360" alt="Demo" src="./images/demo.gif" />
</img>
</p>

<p align="center">
  💬 Questions, ideas, or just want to say hi? <a href="https://github.com/Bolt-builder/bolt-cli/discussions">Join the Discussions</a>
</p>

---

## Why Bolt?

Bolt reads your codebase, understands what you're building, and ships code with you: in the terminal, and as a desktop app.

- **Terminal-first.** A fast, keyboard-driven TUI built with [Effect](https://effect.website), [OpenTUI](https://github.com/opentui/opentui), and [SolidJS](https://www.solidjs.com).
- **A whole team of agents.** Ten specialized agents (code, plan, ask, review, debug, refactor, docs, security, migrate, perf) plus subagents for research and multi-step tasks.
- **Sessions you can leave and re-join.** Detach, attach (even to a remote server), fork, share, export, and import your work at any time.
- **Extensible by design.** MCP servers with OAuth, plugins, GitHub integration, and a built-in API server and web UI.
- **Desktop app.** The same engine wrapped in a multi-window desktop experience with tabs, an integrated terminal, and auto-updates.

## Get started in 30 seconds

```bash
# Quick install (macOS / Linux)
curl -fsSL https://raw.githubusercontent.com/bolt-builder/bolt-cli/dev/install | bash

# Or with npm / bun / pnpm / yarn
npm i -g @bolt-builder/bolt-cli

# Or with Homebrew (macOS / Linux)
brew install bolt-builder/tap/bolt-cli

# Or try it without installing
npx @bolt-builder/bolt-cli
```

Then, from any project:

```bash
# Open the TUI in the current directory
bolt

# Run a prompt directly (non-interactive)
bolt run "explain this codebase"

# Attach to a running server (local or remote)
bolt attach <url>

# Start a session with a specific agent
bolt run --agent ask "what does this project do?"
```

That's it. Bolt picks up your project context automatically.

## Agents

Built-in agents. Switch with `Tab` in the TUI.

| Agent          | Access | Description                                                              |
| -------------- | ------ | ------------------------------------------------------------------------ |
| `orchestrator` | Full   | Coordinates complex multi-step tasks by delegating to specialized agents |
| `code`         | Full   | Default: reads, writes, runs code                                        |
| `plan`         | Read   | Explores and produces a plan without changing code                       |
| `ask`          | Read   | Questions and research, no file edits                                    |
| `code-review`  | Read   | Reviews changes for correctness, style, and security                     |
| `debug`        | Full   | Debugs failing tests, crashes, and logic errors                          |
| `refactor`     | Full   | Safe refactoring with test verification at each step                     |
| `docs`         | Edit   | Writes and updates documentation and comments                            |
| `security`     | Read   | Security audit: vulnerabilities, secrets, patterns                       |
| `migrate`      | Full   | Framework upgrades and dependency migrations                             |
| `perf`         | Full   | Performance analysis and optimization                                    |

Subagents for delegation: `@general` for complex multi-step tasks and `@explore` for fast read-only codebase research. You can also define your own agents as markdown files or generate one with `bolt agent create`.

## Power features

- **Remote sessions**: `bolt attach <url>` and `bolt run --attach <url>` work against any running server, with basic auth and mDNS discovery (`serve --mdns`).
- **Fork and share**: branch a session with `--fork`, share with `run --share`, import straight from a share URL with `bolt import <url>`, export sanitized transcripts with `export --sanitize`.
- **Model control**: pick reasoning effort with `run --variant`, show reasoning with `--thinking`, stream raw events with `--format json`.
- **MCP with OAuth**: `bolt mcp add/auth/logout/debug` manages servers end to end, including OAuth flows and connectivity probes.
- **Minimal mode**: `--mini` gives a compact interactive UI on `bolt`, `run`, and `attach`.
- **Local data, inspectable**: your sessions live in sqlite; query them with `bolt db` any time.

## Desktop app

Bolt also ships as a desktop app: multi-window and multi-tab session management, a prompt composer with attachments and clipboard image paste, an integrated terminal and file tree, a command palette, full settings (keybinds, models, providers, servers), native notifications, deep links, WSL integration on Windows, auto-updates across dev/beta/prod channels, and 17 UI languages. Download it from the [releases page](https://github.com/Bolt-builder/bolt-cli/releases).

> [!TIP]
> On macOS you can install it in one line, no Gatekeeper detour:
>
> ```bash
> curl -fsSL https://raw.githubusercontent.com/bolt-builder/bolt-cli/dev/install-desktop | bash
> ```

## Configuration

Configuration lives in `.bolt/bolt.jsonc` in your project root (created on first run).

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    // Provider config goes here
  },
}
```

### Environment variables

| Variable               | Description                         |
| ---------------------- | ----------------------------------- |
| `BOLT_LOG_LEVEL`       | Log level: DEBUG, INFO, WARN, ERROR |
| `BOLT_PRINT_LOGS`      | Print logs to stderr                |
| `BOLT_PURE`            | Run without external plugins        |
| `BOLT_SERVER_PASSWORD` | Basic auth password for the server  |
| `BOLT_SERVER_USERNAME` | Basic auth username for the server  |

<details>
<summary><strong>All CLI commands</strong></summary>

| Command      | Description                                              |
| ------------ | -------------------------------------------------------- |
| `bolt`       | Launch the interactive TUI                               |
| `run`        | Run a non-interactive prompt                             |
| `attach`     | Attach the TUI to a running server                       |
| `session`    | Manage sessions (list, delete)                           |
| `agent`      | List and create agents                                   |
| `providers`  | Manage LLM provider credentials (alias: `auth`)          |
| `models`     | List available models                                    |
| `mcp`        | Manage MCP servers (add, list, auth, logout, debug)      |
| `serve`      | Start the headless API server                            |
| `web`        | Start the server and open the web UI                     |
| `upgrade`    | Upgrade to the latest version                            |
| `uninstall`  | Remove bolt                                              |
| `completion` | Generate shell completions                               |
| `export`     | Export session history (with optional `--sanitize`)      |
| `import`     | Import a session from a file or share URL                |
| `plugin`     | Install and manage plugins                               |
| `github`     | GitHub Actions agent (install, run)                      |
| `pr`         | Check out a GitHub PR into a local branch                |
| `commit`     | Commit staged changes with a generated message           |
| `review`     | AI review of a diff with pass/fail exit codes            |
| `stats`      | Show token usage and cost statistics                     |
| `db`         | Query the local session database                         |
| `debug`      | Troubleshooting tools (config, lsp, snapshots, and more) |
| `acp`        | Agent Client Protocol server for editors (e.g. Zed)      |

</details>

## Roadmap

The roadmap is about one thing: making the agent smarter, more autonomous, and more fun to work with. It is deliberately short. Items land when they land, in no guaranteed order, and anything we are not confident we will build stays off the list. Have an opinion? [Tell us in Discussions](https://github.com/Bolt-builder/bolt-cli/discussions).

### Now

- [ ] Multi-agent pipelines: one agent plans, one codes, one reviews; a tiny eng team in your terminal
- [ ] Automatic agent selection: Bolt reads your prompt and quietly routes it to the right specialist

> Under the hood, the session sync engine and V2 session core keep rolling out. They are the plumbing that makes everything below possible.

### Next

<details>
<summary><strong>Agents with better hands (4)</strong></summary>

- [ ] Browser tool: navigate and screenshot the running app to verify UI changes visually
- [ ] Semantic codebase search: find code by meaning, not regex
- [ ] LSP power tools: rename symbol and find references, promoted out of experimental
- [ ] `sql` tool: run read-only queries against the project database with schema awareness

</details>

<details>
<summary><strong>Agents that check their work (4)</strong></summary>

- [ ] Regression guard: auto-generate a failing test from every bug before fixing it
- [ ] Static analysis pass folded into every diff (lint, types, dead code) before handoff
- [ ] Test impact analysis: run only the tests the diff can actually break
- [ ] Doc-code drift detection: flag READMEs and comments the diff just made stale

</details>

<details>
<summary><strong>Guardrails and recovery (5)</strong></summary>

- [ ] Guardrail agent that vetoes risky commands before they run
- [ ] Budget guards: `--max-cost` and `--max-tokens` on any run
- [ ] `bolt undo` and named checkpoints: rewind the repo and the conversation together
- [ ] Dry-run mode: show every file write and command a plan would execute without doing it
- [ ] Protected paths: glob-based no-touch zones the agent cannot edit

</details>

<details>
<summary><strong>Context and memory (5)</strong></summary>

- [ ] Pre-emptive compaction: summarize in the background at 80% context, never mid-prompt
- [ ] Context pinning: mark files and facts that must never be compacted away
- [ ] Context budget meter live in the TUI status bar
- [ ] Memory search: full-text and semantic search over everything the agent has learned
- [ ] Memory decay: stale facts age out unless reconfirmed

</details>

<details>
<summary><strong>Git, review, and CI (5)</strong></summary>

- [ ] Review findings posted as comment drafts on the GitHub PR, not just printed locally
- [ ] Incremental re-review: only newly pushed commits get re-reviewed
- [ ] PR description generation kept in sync with the final diff
- [ ] GitHub Actions failure triage wired to `bolt bisect`
- [ ] Auto-rerun of known-flaky jobs, escalating into `bolt flaky` quarantine

</details>

<details>
<summary><strong>Interfaces (5)</strong></summary>

- [ ] Split-pane TUI: conversation on one side, live diff on the other
- [ ] Session tabs: several conversations in one TUI instance
- [ ] Hunk-level diff review with accept and reject keys
- [ ] Windows and Linux desktop builds with the one-line installer
- [ ] VS Code extension: inline diff apply and a session sidebar on top of today's launch integration

</details>

<details>
<summary><strong>Providers, cost, and performance (5)</strong></summary>

- [ ] Local model support: Ollama and llama.cpp as first-class providers
- [ ] Automatic gateway failover when a provider errors mid-run
- [ ] Cost estimate for a task before you run it
- [ ] Parallel tool execution when calls are independent
- [ ] Benchmark suite tracked in CI with regression alerts

</details>

<details>
<summary><strong>Party tricks (3)</strong></summary>

- [ ] `bolt roast`: brutally honest code review mode
- [ ] `bolt tour`: guided walking tour of an unfamiliar codebase, room by room
- [ ] ASCII architecture diagrams rendered live in the TUI, built on `bolt map`

</details>

### Later

Ideas we like and have not scoped. No commitment, no date.

- [ ] Autonomous long-horizon projects spanning days
- [ ] Fine-tuned repo-specific models
- [ ] On-device small-model routing for trivial tasks
- [ ] AI release manager: cut, verify, and publish releases end to end

### Done

- [x] `multiedit`: batch several edits to one file in a single tool call
- [x] Background process tools: `background` start, output, list, and kill without blocking the loop
- [x] `test_run`: run tests and hand the agent structured failures
- [x] Patch tool: apply unified diffs directly instead of line edits for big mechanical changes
- [x] Image reads: the agent opens screenshots and design mocks with the `read` tool
- [x] MCP servers with OAuth: `bolt mcp add/auth/logout/debug`
- [x] VS Code extension (`sdks/vscode`) and ACP for editors like Zed
- [x] Web UI: `bolt web` starts the server and opens the browser dashboard
- [x] Custom agents defined as markdown in your repo, or generated with `bolt agent create`
- [x] `bolt refactor`: test-aware refactor loops that change, run, verify, and repeat until green
- [x] Session replays: `bolt export --html` writes a self-contained HTML replay of any session, with a step-through timeline you can share
- [x] Design-to-code: `bolt figma <url>` fetches a Figma node and has the agent generate components matching your repo's conventions
- [x] Codebase maps: `bolt map` walks your source tree and draws a mermaid map of directory dependencies with per-directory file counts
- [x] Self-review pass: `bolt refactor --self-review` hands the green diff to the code-review agent before you see it
- [x] Confidence scoring: `--confidence` on `bolt review` and `bolt refactor` makes the agent say when it is guessing
- [x] `bolt memory why`: memory introspection that answers why the agent believes something and where it learned it
- [x] `bolt learn`: repo convention learning that saves your codebase's style into project memory
- [x] On-red-main automation: `bolt bisect "<command>" --good <ref>` finds the culprit commit, shows blame, and `--fix` proposes the patch
- [x] Flaky test detection and quarantining: `bolt flaky "<command>"` reruns your tests and records flaky offenders in `.bolt/quarantine.json`
- [x] `bolt cron`: schedule recurring agent chores with `cron add/list/rm/start`, each trigger running as a background job
- [x] Background job queue: `bolt run --background` starts detached jobs you manage with `bolt jobs list/tail/kill`
- [x] Watch mode: `bolt watch "<command>"` reruns your tests on every save, and `--fix` sends failures to the agent so they fix themselves
- [x] Compounding memory: every session teaches the next one, automatically
- [x] Cross-session recall: new sessions start with project memory and `memory_save` / `memory_recall` in every agent's toolbox
- [x] `bolt review --staged / --branch`: one-shot AI diff review with exit codes
- [x] `bolt commit`: commit messages you don't have to rewrite
- [x] Best-of-N runs: fire the same task at several models in parallel, rank the results, keep the winner
- [x] Push-to-talk voice input in the TUI
- [x] Agent evaluation benchmark harness (`bolt eval`)
- [x] Project memory module: automatic capture with save and recall tools
- [x] `bolt memory`: view and edit what the agent remembers per project (`/memory` in the TUI)
- [x] Per-session memory controls
- [x] `/plan` mode, `/todos` task list, and `/btw` side questions that don't interrupt the task
- [x] `bolt logs` with tail and follow
- [x] `.boltignore`-aware agent file search
- [x] macOS desktop app with a one-line terminal installer (no Gatekeeper detour)

## Contributing

We'd love your help, whether it's a bug fix, a new provider, or better docs. Read the [contributing guide](./CONTRIBUTING.md) to get started, or pick up a [good first issue](https://github.com/Bolt-builder/bolt-cli/issues?q=is%3Aissue+state%3Aopen+label%3A%22good+first+issue%22).

```bash
# Clone and build
git clone https://github.com/Bolt-builder/bolt-cli.git
cd bolt-cli
bun install

# Start the TUI in dev mode (from packages/bolt)
cd packages/bolt
bun dev

# Run tests (from package directories)
bun test

# Type-check
bun typecheck

```

## Enjoying Bolt?

Consider giving it a star ⭐ — it helps other developers discover the project, and it's the easiest way to support the work if you can't contribute code right now.

## License

AGPL-3.0 © [Bolt CLI](https://github.com/Bolt-builder/bolt-cli)
