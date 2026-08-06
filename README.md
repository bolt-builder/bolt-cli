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

The roadmap is about one thing: making the agent smarter, more autonomous, and more fun to work with. There are 250 open items below, grouped by theme. Have an opinion? [Tell us in Discussions](https://github.com/Bolt-builder/bolt-cli/discussions).

### Now

- [ ] Multi-agent pipelines: one agent plans, one codes, one reviews; a tiny eng team in your terminal
- [ ] Automatic agent selection: Bolt reads your prompt and quietly routes it to the right specialist

> Under the hood, the session sync engine and V2 session core keep rolling out. They are the plumbing that makes everything below possible.

### Next

<details>
<summary><strong>Agents with better hands (10)</strong></summary>

- [ ] `multiedit`: batch several edits to one file in a single tool call
- [ ] Background process tools: start a dev server, poll its output, kill it, all without blocking the loop
- [ ] `test_run`: run tests and hand the agent structured failures (file, line, message)
- [ ] `view_image`: let the agent look at screenshots and design mocks
- [ ] Browser tool: navigate and screenshot the running app to verify UI changes visually
- [ ] LSP power tools: rename symbol and find references, promoted out of experimental
- [ ] Semantic codebase search: find code by meaning, not regex
- [ ] `sql` tool: run read-only queries against the project database with schema awareness
- [ ] `http` tool: call APIs with saved auth profiles and typed response capture
- [ ] Patch tool: apply unified diffs directly instead of line edits for big mechanical changes

</details>

<details>
<summary><strong>Agents that check their work (10)</strong></summary>

- [ ] Mutation testing: the agent mutates code to prove your tests actually catch bugs
- [ ] Property-based test generation for pure functions the agent touches
- [ ] Static analysis pass folded into every diff (lint, types, dead code) before handoff
- [ ] Regression guard: auto-generate a failing test from every bug before fixing it
- [ ] Assertion mining: suggest missing assertions in existing tests
- [ ] Coverage-aware planning: prefer changes in well-tested code, flag changes in untested code
- [ ] Invariant checks: the agent states invariants before refactoring and verifies them after
- [ ] Doc-code drift detection: flag READMEs and comments the diff just made stale
- [ ] Type-tightening pass: propose stricter types for code the agent touched
- [ ] Performance regression check: benchmark hot paths before and after the change

</details>

<details>
<summary><strong>Agents with guardrails (10)</strong></summary>

- [ ] Guardrail agent that vetoes risky commands before they run
- [ ] Budget guards: `--max-cost` and `--max-tokens` on any run
- [ ] `bolt undo`: one-command rollback when an experiment goes sideways
- [ ] Named checkpoints: save points you can rewind the repo and the conversation to
- [ ] Secrets firewall: redact tokens and keys from prompts, logs, and replays automatically
- [ ] Dry-run mode: show every file write and command the plan would execute without doing it
- [ ] Blast-radius estimates: how many callers, tests, and packages a diff touches, before applying
- [ ] Protected paths: glob-based no-touch zones the agent cannot edit
- [ ] Rate-limited tool budgets per session (max shell commands, max file writes)
- [ ] Two-agent approval: destructive commands need a second agent's sign-off

</details>

<details>
<summary><strong>Party tricks II (10)</strong></summary>

- [ ] Pair-programming mode with a shared cursor
- [ ] Whiteboard-to-architecture: photo of a sketch in, scaffolded services out
- [ ] Commit-history time-lapse video generator
- [ ] `bolt roast`: brutally honest code review mode
- [ ] Repo trivia: the agent quizzes your team on your own codebase
- [ ] ASCII architecture diagrams rendered live in the TUI
- [ ] Changelog rap: release notes in the style of your choice
- [ ] Code golf mode: the agent minimizes a function and explains every trick
- [ ] `bolt tour`: guided walking tour of an unfamiliar codebase, room by room
- [ ] Emoji-only commit summaries as a hidden flag

</details>

<details>
<summary><strong>Multi-agent orchestration (10)</strong></summary>

- [ ] Planner/worker/reviewer roles with explicit handoff artifacts
- [ ] Agent debate: two agents argue an approach, a judge picks the plan
- [ ] Parallel worktree swarms: N agents on N branches, merged by a coordinator
- [ ] Specialist registry: frontend, infra, database, and docs agents with routed dispatch
- [ ] Subagent progress streaming into one unified timeline
- [ ] Deadlock detection when agents wait on each other
- [ ] Shared scratchpad memory between agents in one pipeline
- [ ] Cost-aware orchestration: cheap models draft, expensive models verify
- [ ] Pipeline templates: reusable YAML definitions of multi-agent flows
- [ ] Cross-repo pipelines: one plan spanning several repositories

</details>

<details>
<summary><strong>Memory and learning (10)</strong></summary>

- [ ] Memory decay: stale facts age out unless reconfirmed
- [ ] Memory conflicts: detect and resolve contradictory learned facts
- [ ] Team memory: opt-in shared project memory across teammates
- [ ] Memory diffs: see exactly what a session added to memory before it persists
- [ ] Negative memory: remember what did NOT work to avoid repeating it
- [ ] Memory search: full-text and semantic search over everything learned
- [ ] Per-directory memory scopes for monorepos
- [ ] Memory import/export as reviewable markdown
- [ ] Auto-learned build/test commands per project, no config needed
- [ ] Memory provenance: every fact links to the session and message that taught it

</details>

<details>
<summary><strong>Context engine (10)</strong></summary>

- [ ] Pre-emptive compaction: summarize in the background at 80% context, never mid-prompt
- [ ] Context pinning: mark files and facts that must never be compacted away
- [ ] Smart file ranking: recently failing tests and hot files first
- [ ] Diff-aware context: load only the hunks that matter, not whole files
- [ ] Context budget meter live in the TUI status bar
- [ ] Cross-file symbol graphs injected for the code under edit
- [ ] Context replay: inspect exactly what the model saw for any past turn
- [ ] Adaptive context per model: small models get distilled context automatically
- [ ] Conversation branching with shared prefix caching
- [ ] Context lint: warn when the prompt contains contradictory instructions

</details>

<details>
<summary><strong>Codebase intelligence (10)</strong></summary>

- [ ] Whole-repo embedding index with incremental updates on save
- [ ] Ownership map: who owns what, inferred from history and CODEOWNERS
- [ ] Dead code radar: confidently unused exports, ranked by deletion safety
- [ ] Dependency health report: outdated, vulnerable, and abandoned packages
- [ ] Architectural drift detection against a declared module contract
- [ ] Hotspot analysis: files with high churn and high complexity flagged for refactor
- [ ] API surface tracking: public interface diffs across versions
- [ ] Duplicate logic finder: near-identical code across the repo
- [ ] Migration assistant: framework and major-version upgrade playbooks
- [ ] Monorepo package graph with build-order awareness

</details>

<details>
<summary><strong>Git and version control (10)</strong></summary>

- [ ] Stacked PR support: split one big change into an ordered, reviewable stack
- [ ] Semantic conflict resolution: merge conflicts resolved by intent, not lines
- [ ] `bolt rebase`: agent-driven interactive rebase with explained decisions
- [ ] Commit message linting against your repo's own conventions
- [ ] Auto-split commits: one logical change per commit from a messy worktree
- [ ] Worktree manager: create, list, and clean agent worktrees safely
- [ ] Cherry-pick assistant: port a fix across release branches
- [ ] Git archaeology: "when and why did this behavior change?" answered with evidence
- [ ] Submodule-aware operations end to end
- [ ] Signed-commit verification surfaced in review and bisect output

</details>

<details>
<summary><strong>Code review (10)</strong></summary>

- [ ] Review comment drafts posted directly to GitHub PRs
- [ ] Severity-calibrated findings tuned by your past accept/reject decisions
- [ ] Security-focused review profile (injection, authz, secrets, crypto misuse)
- [ ] Accessibility review profile for UI diffs
- [ ] Review checklists generated from AGENTS.md and CONTRIBUTING.md
- [ ] Incremental re-review: only newly pushed commits get re-reviewed
- [ ] Cross-PR awareness: flag conflicting in-flight PRs before merge
- [ ] Review analytics: which finding categories your team fixes vs ignores
- [ ] Suggested-change patches attached to every finding
- [ ] Reviewer personas: strict, pragmatic, or mentoring tone per run

</details>

<details>
<summary><strong>Testing and QA (10)</strong></summary>

- [ ] Test generation from types and docstrings with human-readable names
- [ ] Snapshot test triage: explain what changed and whether it looks intended
- [ ] E2E test recorder: turn a browser session into a Playwright spec
- [ ] Test impact analysis: run only tests affected by the diff
- [ ] Fixture factory generation from schema definitions
- [ ] Fuzz harness scaffolding for parsers and codecs
- [ ] Visual regression baseline management
- [ ] Test speed profiler with slowest-test leaderboard
- [ ] Quarantine dashboard: flaky list with age, owner, and deflake suggestions
- [ ] Contract tests generated from OpenAPI and GraphQL schemas

</details>

<details>
<summary><strong>CI/CD and automation (10)</strong></summary>

- [ ] GitHub Actions failure triage bot wired to `bolt bisect`
- [ ] Auto-rerun of known-flaky jobs with quarantine escalation
- [ ] PR description generation kept in sync with the final diff
- [ ] Release notes drafted from merged PRs, grouped by user impact
- [ ] Dependency bump PRs with changelog digests and risk notes
- [ ] Workflow linting: catch broken YAML and deprecated actions before push
- [ ] Merge queue awareness: rebase and revalidate at the front of the queue
- [ ] Deploy gate: agent checks dashboards and error rates after ship
- [ ] Issue triage cron: label, dedupe, and draft responses on new issues
- [ ] Nightly repo health report delivered as a single markdown brief

</details>

<details>
<summary><strong>Terminal and TUI (10)</strong></summary>

- [ ] Split-pane TUI: conversation on one side, live diff on the other
- [ ] Inline images in supported terminals (kitty, iTerm2, WezTerm)
- [ ] Mouse-free diff review with hunk-level accept/reject keys
- [ ] Session tabs: several conversations in one TUI instance
- [ ] Theme marketplace with hot-reload preview
- [ ] Vim and Emacs keybinding profiles
- [ ] Status line API for prompt frameworks (starship, p10k)
- [ ] Notification hooks: desktop alerts when a long run finishes
- [ ] Scrollback search with regex and time filters
- [ ] Zero-flicker rendering on slow SSH connections

</details>

<details>
<summary><strong>Desktop and GUI (10)</strong></summary>

- [ ] Windows and Linux desktop builds with the one-line installer
- [ ] Diff review UI with side-by-side and inline modes
- [ ] Session browser: search, filter, and resume past sessions visually
- [ ] Drag-and-drop images and files into the conversation
- [ ] Global hotkey quick-ask window
- [ ] Menu bar mode: fire-and-forget tasks from the tray
- [ ] Multi-window: one window per project, shared daemon
- [ ] Native notifications with actionable buttons (view diff, retry)
- [ ] In-app changelog and update flow without reinstalling
- [ ] Offline queue: compose tasks offline, run when back online

</details>

<details>
<summary><strong>Editor integrations (10)</strong></summary>

- [ ] VS Code extension with inline diff apply and session sidebar
- [ ] JetBrains plugin sharing the same daemon protocol
- [ ] Neovim plugin with buffer-level context sync
- [ ] Inline ghost-text suggestions backed by project memory
- [ ] Editor-aware context: open buffers and cursor position inform the agent
- [ ] Jump-to-source from every file reference in the conversation
- [ ] Apply-hunk UX: accept agent edits hunk by hunk in the editor
- [ ] Problems-panel sync: editor diagnostics feed the agent automatically
- [ ] Notebook support: agent edits Jupyter cells with execution awareness
- [ ] Zed extension speaking the native collaboration protocol

</details>

<details>
<summary><strong>Providers and gateways (10)</strong></summary>

- [ ] Gateway health dashboard: latency and error rate per configured gateway
- [ ] Automatic gateway failover when a provider errors mid-run
- [ ] Free-tier optimizer: route to the best currently-free model
- [ ] Local model support: Ollama and llama.cpp as first-class providers
- [ ] Provider capability matrix auto-detected (tools, vision, caching, JSON mode)
- [ ] Per-project provider allowlists for compliance
- [ ] OAuth device flow for gateways that support it, no key pasting
- [ ] Streaming cost ticker per provider in the status bar
- [ ] Custom provider templates shareable as one-line imports
- [ ] Gateway usage export: monthly spend per provider as CSV

</details>

<details>
<summary><strong>Model routing and cost (10)</strong></summary>

- [ ] Task-complexity router: trivial edits go to small models automatically
- [ ] Cost simulator: estimate a task's price before running it
- [ ] Session budgets with hard stops and graceful wind-down
- [ ] Per-team spend reports with model breakdowns
- [ ] Cache-hit optimizer: reorder context for maximum prefix reuse
- [ ] Latency-based routing: fastest healthy provider wins ties
- [ ] Quality feedback loop: routing learns from accepted vs rejected outputs
- [ ] Batch mode: queue cheap overnight runs on discounted throughput
- [ ] Token diet mode: aggressive prompt compression for constrained budgets
- [ ] Spot-style preemption: pause and resume runs when prices spike

</details>

<details>
<summary><strong>Performance and scale (10)</strong></summary>

- [ ] Sub-second cold start for the CLI on every platform
- [ ] Incremental repo scanning: only re-index what changed
- [ ] Streaming tool output: no buffering entire command results in memory
- [ ] Parallel tool execution when calls are independent
- [ ] Session storage compaction and archival policies
- [ ] 1M-file monorepo support with lazy directory hydration
- [ ] Memory ceiling for the daemon with graceful degradation
- [ ] Binary size diet: smaller installs, faster updates
- [ ] Profiling harness: flame graphs for slow agent turns
- [ ] Benchmark suite tracked in CI with regression alerts

</details>

<details>
<summary><strong>Observability and analytics (10)</strong></summary>

- [ ] Session timeline view: every tool call, token count, and pause explained
- [ ] Where-did-my-tokens-go breakdown per session
- [ ] Agent success metrics: task completion rate, edit acceptance rate
- [ ] OpenTelemetry export for traces and metrics
- [ ] Slow-turn analyzer: what made this response take 90 seconds?
- [ ] Tool failure heatmap across sessions
- [ ] Weekly digest: what the agent shipped, learned, and struggled with
- [ ] Audit log: every command and file write, tamper-evident
- [ ] Error clustering across sessions with suggested root causes
- [ ] Self-report: the agent grades its own week and proposes improvements

</details>

<details>
<summary><strong>Security and privacy (10)</strong></summary>

- [ ] Sandboxed shell execution with per-project capability profiles
- [ ] Prompt injection detection on all fetched web and file content
- [ ] PII scrubbing before anything leaves the machine
- [ ] SBOM generation and license compliance checks in one command
- [ ] Dependency vulnerability autofix PRs with exploitability notes
- [ ] Local-only mode: hard guarantee that no code leaves localhost
- [ ] Secret scanning pre-commit with agent-suggested remediation
- [ ] Signed plugin distribution with a verification chain
- [ ] SSO and SCIM for team installations
- [ ] Compliance profiles: SOC2 and HIPAA operating modes

</details>

<details>
<summary><strong>Collaboration and teams (10)</strong></summary>

- [ ] Session handoff: send a live session to a teammate with full context
- [ ] Team playbooks: shared prompts and pipelines versioned in the repo
- [ ] Slack integration: delegate tasks and get PR links back in-channel
- [ ] Shared quarantine and flaky-test lists across the team
- [ ] Async standup: the agent summarizes everyone's merged work daily
- [ ] Knowledge handbook auto-built from team sessions and memory
- [ ] Review load balancing: route PRs to the least-loaded qualified reviewer
- [ ] Onboarding mode: new hires get a guided, memory-backed repo tour
- [ ] Multi-tenant server: one daemon, many developers, isolated state
- [ ] Org-wide roadmap board fed by agent-discovered tech debt

</details>

<details>
<summary><strong>Extensibility and plugins (10)</strong></summary>

- [ ] Stable plugin API v1 with semver guarantees
- [ ] Plugin marketplace with ratings and install counts
- [ ] Custom tool SDK: add a tool with one TypeScript file
- [ ] MCP client and server support, both directions
- [ ] Webhook triggers: start runs from external events
- [ ] Custom agent definitions in the repo (.bolt/agents/)
- [ ] Scriptable lifecycle hooks: pre-run, post-diff, pre-commit
- [ ] Language packs: community-maintained conventions per ecosystem
- [ ] Headless SDK: drive bolt from Node, Python, and Go programs
- [ ] Template repos: `bolt new` project scaffolds with agents preconfigured

</details>

<details>
<summary><strong>Docs and DX (10)</strong></summary>

- [ ] `bolt docs`: generate and maintain API docs from the code itself
- [ ] Runnable README verification: docs' commands tested in CI
- [ ] Architecture decision records drafted from big diffs
- [ ] Interactive tutorials that run inside the TUI
- [ ] Error messages that link to the exact fix, not a search page
- [ ] `bolt doctor`: one command that diagnoses broken setups
- [ ] Config schema with editor autocomplete and inline docs
- [ ] Migration guides generated between bolt versions
- [ ] Public cookbook of real session transcripts by task type
- [ ] First-run experience: from install to first merged PR in ten minutes

</details>

<details>
<summary><strong>Web, deploy, and runtime (10)</strong></summary>

- [ ] Web dashboard for sessions, jobs, and cron from any browser
- [ ] Remote runners: execute agent work on a beefy box, drive it locally
- [ ] Container-native mode: every session in a disposable sandbox image
- [ ] Preview deployments wired into the verification loop
- [ ] Infra-as-code awareness: Terraform and Pulumi plan review
- [ ] Kubernetes operator for team-scale bolt daemons
- [ ] Serverless task API: POST a prompt, get a PR link back
- [ ] Artifact store for build outputs the agent produces
- [ ] Edge config: run trivial routing decisions without a round trip
- [ ] Self-hosted gateway image with metering built in

</details>

### Later

- [ ] Autonomous long-horizon projects spanning days
- [ ] Fine-tuned repo-specific models
- [ ] On-device small-model routing for trivial tasks
- [ ] Agent federation across organizations
- [ ] AI release manager: cut, verify, and publish releases end to end
- [ ] Voice-first pair programming sessions
- [ ] Formal verification assistance for critical modules
- [ ] Self-improving toolchain: the agent proposes and ships its own tool upgrades

### Done

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
