<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:3e428acc557b357148e0117de856c52bcbbeb81e15588907a2d64a2822be7e41 -->

# Bolt V1 parity checklist

Reference: pre-sync V1 commit `0cae319f4f7065f0bcd4335a579033dac706b7d0`. Restoration base: merged PR #420 (`f60f5a6c8a09526ed9306939abadfe9dedd46074`).

A registered name does not establish parity. **Verified** means the named behavior was exercised, including settings or failure handling where relevant. Integrated rows remain open until comparison is complete. Historical V1 handler references sometimes point to services absent from this revision; those need implementation or an explicitly documented replacement, not a claim of existing behavior.

## Identity and terminal presentation

| Feature | Status | Evidence / remaining checks |
| --- | --- | --- |
| Literal original dollar-sign wordmark | Verified | TUI `test/component/bolt-logo.test.tsx`; narrow/wide layouts preserve underscore strokes |
| Original horizontal accent → primary gradient | Verified | Renderer endpoint tests; migration preserves exact light/dark/custom endpoints in theme `test/theme.test.ts` |
| Gradient exit wordmark follows selected theme | Verified | TUI `test/util/presentation.test.ts` |
| BOLT CLI session title, root count and child status header | Integrated | TUI appearance test covers root header at 44/100 columns and small-height hiding; child status audit pending |
| WASM fire simulation and recovery | Verified | TUI `test/ui/fire.test.ts`, including long-running WASM advances and trap recovery |
| Activity-only fire and independent persisted setting | Verified | TUI `test/bolt-appearance.test.tsx`; idle/completion clears rows, per-fire toggle and global animations suppression |
| Legacy fire preference/keybinding migration | Integrated | CLI config suite; full legacy global directory migration pending |
| Reduced motion | Integrated | Global animations suppresses fire; OS/browser reduced-motion and all animations audit pending |
| Shared web/desktop Bolt logo/theme | Integrated | Shared cloud About/light/dark checks; production browser regression 80/80, theme unit 13/13; native window verification pending |

## CLI commands and flags

Each source below is read from the reference commit. Nested commands retain their source context. The flag column lists explicit V1 options in that source, including its subcommands; inherited globals and aliases require the separate global parser audit.

| V1 command | Explicit V1 flags | Status | Evidence / next check | Reference source |
| --- | --- | --- | --- | --- |
| `alias [entry]` | `--rm` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/alias.ts` |
| `analyze` | `--staged`, `--branch` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/analyze.ts` |
| `arch` | `--contract` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/arch.ts` |
| `arena [message..]` | `--models`, `--judge`, `--agent`, `--variant`, `--format`, `--cleanup` | Integrated; detailed parity pending | test/tournament-command.test.ts; test/arena.test.ts | `packages/cli/src/commands/handlers/arena.ts` |
| `ask <question..>` | `--model`, `--agent` | Integrated; detailed parity pending | test/one-shot-command.test.ts | `packages/cli/src/commands/handlers/ask.ts` |
| `asserts [files..]` | `--branch`, `--suggest`, `--model` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/asserts.ts` |
| `batch <file>` | `--parallel`, `--model`, `--agent` | Integrated; detailed parity pending | test/workflow-commands.test.ts (parallel retained sessions) | `packages/cli/src/commands/handlers/batch.ts` |
| `bench <command>` | `--base`, `--runs`, `--warmup`, `--threshold` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/bench.ts` |
| `bisect <command>` | `--good`, `--fix`, `--model` | Integrated; native platforms pending | Real Git/SSE integration: 1 test / 61 assertions; culprit, readonly proposal, boundary failures and worktree cleanup | `packages/cli/src/commands/handlers/bisect.ts` |
| `blast` | `--staged`, `--branch` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/blast.ts` |
| `checkpoint` | `--session`, `--repo-only` | Integrated; detailed parity pending | test/checkpoint-command.test.ts; Core bolt-checkpoint/snapshot/session-revert suites (14 tests / 64 assertions) | `packages/cli/src/commands/handlers/checkpoint.ts` |
| `checkpoint save <name>` | `--session`, `--repo-only` | Integrated; detailed parity pending | test/checkpoint-command.test.ts; Core bolt-checkpoint/snapshot/session-revert suites (14 tests / 64 assertions) | `packages/cli/src/commands/handlers/checkpoint.ts` |
| `checkpoint list` | `--session`, `--repo-only` | Integrated; detailed parity pending | test/checkpoint-command.test.ts; Core bolt-checkpoint/snapshot/session-revert suites (14 tests / 64 assertions) | `packages/cli/src/commands/handlers/checkpoint.ts` |
| `checkpoint rewind <name>` | `--session`, `--repo-only` | Integrated; detailed parity pending | test/checkpoint-command.test.ts; Core bolt-checkpoint/snapshot/session-revert suites (14 tests / 64 assertions) | `packages/cli/src/commands/handlers/checkpoint.ts` |
| `checkpoint remove <name>` | `--session`, `--repo-only` | Integrated; detailed parity pending | test/checkpoint-command.test.ts; Core bolt-checkpoint/snapshot/session-revert suites (14 tests / 64 assertions) | `packages/cli/src/commands/handlers/checkpoint.ts` |
| `codemod [description]` | `--pattern`, `--rewrite`, `--lang`, `--apply`, `--model` | Verified preview/apply and generation | Original helper tests and actual ast-grep integration: 14 tests / 43 assertions; readonly model#variant generation and no-match/errors | `packages/cli/src/commands/handlers/codemod.ts` |
| `commit` | `--all`, `--dry-run`, `--model` | Integrated; detailed parity pending | test/one-shot-command.test.ts | `packages/cli/src/commands/handlers/commit.ts` |
| `commitlint` | `--range`, `--history` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/commitlint.ts` |
| `config diff` | `--patch` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/config/diff.ts` |
| `config doctor` | — | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/config/doctor.ts` |
| `config get <key>` | `--global` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/config/edit.ts` |
| `config set <key> <value>` | `--global` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/config/edit.ts` |
| `config unset <key>` | `--global` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/config/edit.ts` |
| `config edit` | — | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/config/editor.ts` |
| `config` | — | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/config/index.ts` |
| `cron <action> [args..]` | — | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/cron.ts` |
| `daemon` | `--stop`, `--status` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/daemon.ts` |
| `dead` | `--limit` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/dead.ts` |
| `context <sessionID> [turn]` | — | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/debug/context.ts` |
| `deps` | — | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/deps.ts` |
| `diff-gate` | `--threshold`, `--model` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/diff-gate.ts` |
| `doctor` | — | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/doctor.ts` |
| `drift` | `--staged`, `--branch` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/drift.ts` |
| `dupes` | `--window`, `--limit` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/dupes.ts` |
| `eval [paths..]` | `--model`, `--agent`, `--format`, `--timeout`, `--keep` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/eval.ts` |
| `exec` | `--file`, `--model`, `--agent` | Integrated; detailed parity pending | test/workflow-commands.test.ts (same-session step execution) | `packages/cli/src/commands/handlers/exec.ts` |
| `figma <url>` | `--out`, `--model` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/figma.ts` |
| `flaky <command>` | `--runs`, `--quarantine` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/flaky.ts` |
| `fork <sessionID> [messageID]` | `--resume` | Integrated; detailed parity pending | test/fork-command.test.ts | `packages/cli/src/commands/handlers/fork.ts` |
| `grep <pattern>` | `--ignore-case`, `--limit`, `--json` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/grep.ts` |
| `guard <bug>` | `--model` | Integrated; detailed parity pending | test/verified-workflows.test.ts (actual failing reproduction) | `packages/cli/src/commands/handlers/guard.ts` |
| `hotspots` | `--since`, `--limit` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/hotspots.ts` |
| `index [query]` | `--out`, `--limit`, `--watch` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/indexer.ts` |
| `init [directory]` | `--preset` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/init.ts` |
| `invariants <action> [files..]` | `--range`, `--model` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/invariants.ts` |
| `jobs <action> [id]` | `--follow`, `--health`, `--interval`, `--retries`, `--limit` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/jobs.ts` |
| `learn` | `--model` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/learn.ts` |
| `logs` | `--tail`, `--follow`, `--level`, `--session`, `--json`, `--porcelain` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/logs.ts` |
| `map` | `--out`, `--depth` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/map.ts` |
| `memory` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/memory.ts` |
| `export` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/memory.ts` |
| `import <file>` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/memory.ts` |
| `team <action> [query]` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/memory.ts` |
| `diff` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/memory.ts` |
| `review <mode>` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/memory.ts` |
| `search <query>` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/memory.ts` |
| `conflicts` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/memory.ts` |
| `why <question>` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/memory.ts` |
| `mutate <file>` | `--command`, `--limit`, `--timeout` | Integrated; native platforms pending | Original helpers and real CLI integration: 17 tests / 58 assertions; mutation restoration and actual isolated tmux | `packages/cli/src/commands/handlers/mutate.ts` |
| `mux [dirs..]` | `--count`, `--layout`, `--name` | Integrated; native platforms pending | Original helpers and real CLI integration: 17 tests / 58 assertions; mutation restoration and actual isolated tmux | `packages/cli/src/commands/handlers/mux.ts` |
| `bolt` | `--count`, `--layout`, `--name` | Integrated; native platforms pending | Original helpers and real CLI integration: 17 tests / 58 assertions; mutation restoration and actual isolated tmux | `packages/cli/src/commands/handlers/mux.ts` |
| `owners` | `--since`, `--depth` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/owners.ts` |
| `packages` | `--out` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/packages.ts` |
| `pair` | `--join`, `--session`, `--port`, `--hostname`, `--password`, `--username` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/pair.ts` |
| `pipeline <task>` | `--attempts`, `--model` | Integrated; detailed parity pending | test/verified-workflows.test.ts (plan/code/review retry) | `packages/cli/src/commands/handlers/pipeline.ts` |
| `port <commit>` | `--to`, `--apply`, `--push` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/port.ts` |
| `proptest <file>` | `--name`, `--model` | Integrated; detailed parity pending | test/verified-workflows.test.ts (real test exits) | `packages/cli/src/commands/handlers/proptest.ts` |
| `pull <sessionID> <url>` | `--password`, `--username`, `--dir` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/pull.ts` |
| `push <sessionID> <url>` | `--password`, `--username`, `--dir` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/push.ts` |
| `rebase` | `--onto`, `--apply`, `--model` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/rebase.ts` |
| `refactor <instruction>` | `--test`, `--attempts`, `--model`, `--confidence`, `--self-review` | Integrated; detailed parity pending | test/refactor-command.test.ts (retained session, failure tails, exhausted attempts) | `packages/cli/src/commands/handlers/refactor.ts` |
| `resolve [file..]` | `--apply`, `--model` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/resolve.ts` |
| `resume [sessionID]` | — | Integrated; detailed parity pending | test/resume.test.ts | `packages/cli/src/commands/handlers/resume.ts` |
| `review` | `--staged`, `--branch`, `--model`, `--confidence`, `--json`, `--porcelain` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/review.ts` |
| `split` | `--apply`, `--model` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/split.ts` |
| `stack` | `--base`, `--apply`, `--push`, `--model` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/stack.ts` |
| `submodules` | `--sync` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/submodules.ts` |
| `tighten [files..]` | `--branch`, `--suggest`, `--model` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/tighten.ts` |
| `undo` | `--session`, `--redo` | Integrated; detailed parity pending | test/workflow-commands.test.ts (paginated revert RPC) | `packages/cli/src/commands/handlers/undo.ts` |
| `warm` | `--index` | Integrated; detailed parity pending | test/worktree-command.test.ts (index and --no-index) | `packages/cli/src/commands/handlers/warm.ts` |
| `watch <command>` | `--fix`, `--attempts`, `--model` | **Pending** | No equivalent verified | `packages/cli/src/commands/handlers/watch.ts` |
| `why <question>` | `--file`, `--lines`, `--term`, `--model` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/why.ts` |
| `worktree` | `--start`, `--apply` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/worktree.ts` |
| `worktree list` | `--start`, `--apply` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/worktree.ts` |
| `worktree create [name]` | `--start`, `--apply` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/worktree.ts` |
| `worktree remove <worktree>` | `--start`, `--apply` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/worktree.ts` |
| `worktree clean` | `--start`, `--apply` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/worktree.ts` |

## Tools and services

| V1 feature | V2 implementation / required work | Status |
| --- | --- | --- |
| Browser / screenshots / interaction | Desktop browser plugin exists; terminal/headless browser service and exact V1 operations need audit | Pending |
| Background start / output / list / kill / stdin | `shell` background/shellID/input plus Bolt process RPC; compare permission/cancellation/output contracts | Integrated; parity pending |
| Git status/diff/log/show/blame | Active Git tool; permission/output/lazy-fetch tests from PR #420 | Integrated; final audit pending |
| LSP configuration and servers | Config schema survives; runtime and references/rename integration missing | Pending |
| Coverage / diagnostics / profile / frames / test runner | Reuse V2 process boundaries; restore structured outputs and failure handling | Pending |
| Notebook read/edit/insert/delete | Active notebook tool with FileAccess and locked FileMutation; original helper contracts and permission/metadata integration tests | Verified |
| Multiedit | V2 edit/patch exist; atomic multi-edit semantics need comparison | Pending |
| Tasks with blockers/transitions | Active graph tools with KV, concurrency, session isolation, blocker/terminal transitions and read-only legacy graph import tested | Verified synthetic persistence; live model workflow pending |
| HTTP / SQL / read cache | Original tool contracts and permission boundaries require audit | Pending |
| MCP resources / semantic search / slash invocation | Active V2 tools and command API exist; exact input/output audit pending | Integrated; parity pending |
| Named checkpoints | Active save/list/rewind/remove RPC and CLI; full-project snapshots, attached conversation rewind, immutable V1 object import and collision preservation tested | Integrated; missing-marker rejection and native platforms remain open |
| Undo / redo | CLI uses existing V2 session revert with filesystem restore and paginated history | Verified by actual CLI paginated history and revert transport; redo UI audit pending |
| Mutation guardrails / approvals / dry run | Retain V2 permissions and fail-closed sandbox; compare every original mutation boundary | Pending |
| Project memory / capture / session controls | Existing Bolt memory package/RPC/tools; rich project settings and model override audit | Integrated; parity pending |
| Voice | Existing V2 recording/transcription/RPC; hardware and live providers not verified | Integrated; parity pending |
| Sandbox | bwrap/seatbelt wrapper and network guard; supported-host and permission audit | Integrated; parity pending |
| Budget / notifications | Existing cost threshold UI and stop/continue; settings persistence audit | Integrated; parity pending |
| Persistent jobs / cron | One-time locked V1 imports preserve V2 collisions, source records/logs, live supervisor PID updates and removals; malformed-input and retry tests | Integrated; native Windows lifecycle verification pending |

## Interaction audit

- [ ] Enumerate every V1 slash command and verify its action, argument handling, output and failure behavior.
- [ ] Compare all specialist agents, permissions, hidden/selectable state, temperatures and prompts.
- [ ] Compare keybindings, Vim input, palettes, Mini replay, attachments, cancellation and best-of-N behavior.
- [ ] Preserve V2 workflows, session data and custom themes while migrating global/project V1 configuration.
- [ ] Audit distribution, website/About labels, docs, installers, updater discovery and package/channel artifacts.

## Current verification evidence

- Root `bun run check`: 36/36 packages passed after checkpoint/codemod integration; transcript preferences and subsequent commands require a fresh final run.

- Linux compiled CLI plus embedded production app: passed; final rebuild required after later additions.
- Browser regression: 80/80 with 10 repetitions and no retries (mobile light/dark, project menu, About, pairing).
- Production menu benchmark: three before/after repetitions; median observed latency 124.9 ms → 119.6 ms.

- Production cold-session entry: three passes after correcting the benchmark to measure the visible viewport above the composer; median first-correct 407.10 ms / stable 441.60 ms. Probe unit tests pass; no performance improvement claim.

- Native Windows verification: outstanding.

## Delivery gates

- [ ] Current affected package suites and required repeat tests.
- [ ] Root `bun run check` after all implementation changes.
- [ ] Production web, CLI and relevant desktop builds, including embedded fire WASM.
- [ ] Service smoke tests and real terminal visual checks.
- [ ] Shared cloud browser checks in light/dark modes and reduced motion.
- [ ] Existing Linux/Windows/browser CI failures resolved and rerun on supported hosts.
- [ ] New PR targeting `dev` with actual verification results and this checklist.

The restoration remains in progress. None of the pending rows is covered by a general claim of full parity.


<!-- /coderabbit-ai-generated:v1 -->