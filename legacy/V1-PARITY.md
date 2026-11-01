<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:3cb5712af831b869476fb9315c9a8e48a56bd08b075a4323d5875b256f5a37a4 -->

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
| `daemon` | `--stop`, `--status` | Integrated; native lifecycle pending | Actual isolated V2 server: status, duplicate start, authenticated readiness and stop; 1 test / 16 assertions | `packages/cli/src/commands/handlers/daemon.ts` |
| `dead` | `--limit` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/dead.ts` |
| `debug context <sessionID> [turn]` | — | Verified recording and inspection | Opt-in post-hook snapshots; native V2 format plus read-only V1 compatibility, private permissions and traversal checks; Core runner/replay 249 tests / 1228 assertions, CLI 6 tests / 39 assertions | `packages/cli/src/commands/handlers/debug/context.ts` |
| `deps` | — | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/deps.ts` |
| `diff-gate` | `--threshold`, `--model` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/diff-gate.ts` |
| `doctor` | — | Verified diagnostic failure handling | Real CLI checks for config, credentials, gateway, disk probes and exit status; included in 22 tests / 158 assertions | `packages/cli/src/commands/handlers/doctor.ts` |
| `drift` | `--staged`, `--branch` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/drift.ts` |
| `dupes` | `--window`, `--limit` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/dupes.ts` |
| `eval [paths..]` | `--model`, `--agent`, `--format`, `--timeout`, `--keep` | Integrated; live model grading pending | Real CLI, synthetic SSE and actual grading commands: timeouts, JSON reports, unsafe seeds, workspace cleanup | `packages/cli/src/commands/handlers/eval.ts` |
| `exec` | `--file`, `--model`, `--agent` | Integrated; detailed parity pending | test/workflow-commands.test.ts (same-session step execution) | `packages/cli/src/commands/handlers/exec.ts` |
| `figma <url>` | `--out`, `--model` | Integrated; live Figma pending | Original formatter cases plus HTTP/SSE integration: authenticated node fetch, generation, errors and redirect refusal; eval/Figma suite 19 tests / 87 assertions | `packages/cli/src/commands/handlers/figma.ts` |
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
| `memory export` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | Integrated; detailed parity pending | Actual eight-command management RPC/CLI suite; individual settings/error audit pending | `packages/cli/src/commands/handlers/memory.ts` |
| `memory import <file>` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | Integrated; detailed parity pending | Actual eight-command management RPC/CLI suite; individual settings/error audit pending | `packages/cli/src/commands/handlers/memory.ts` |
| `memory team <action> [query]` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | Integrated; detailed parity pending | Actual eight-command management RPC/CLI suite; individual settings/error audit pending | `packages/cli/src/commands/handlers/memory.ts` |
| `memory diff` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | Integrated; detailed parity pending | Actual eight-command management RPC/CLI suite; individual settings/error audit pending | `packages/cli/src/commands/handlers/memory.ts` |
| `memory review <mode>` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | Integrated; detailed parity pending | Actual eight-command management RPC/CLI suite; individual settings/error audit pending | `packages/cli/src/commands/handlers/memory.ts` |
| `memory search <query>` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | Integrated; detailed parity pending | Actual eight-command management RPC/CLI suite; individual settings/error audit pending | `packages/cli/src/commands/handlers/memory.ts` |
| `memory conflicts` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | Integrated; detailed parity pending | Actual eight-command management RPC/CLI suite; individual settings/error audit pending | `packages/cli/src/commands/handlers/memory.ts` |
| `memory why <question>` | `--out`, `--apply`, `--discard`, `--limit`, `--fix`, `--model` | Integrated; detailed parity pending | Actual eight-command management RPC/CLI suite; individual settings/error audit pending | `packages/cli/src/commands/handlers/memory.ts` |
| `mutate <file>` | `--command`, `--limit`, `--timeout` | Integrated; native platforms pending | Original helpers and real CLI integration: 17 tests / 58 assertions; mutation restoration and actual isolated tmux | `packages/cli/src/commands/handlers/mutate.ts` |
| `mux [dirs..]` | `--count`, `--layout`, `--name` | Integrated; native platforms pending | Original helpers and real CLI integration: 17 tests / 58 assertions; mutation restoration and actual isolated tmux | `packages/cli/src/commands/handlers/mux.ts` |
| `owners` | `--since`, `--depth` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/owners.ts` |
| `packages` | `--out` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/packages.ts` |
| `pair` | `--join`, `--session`, `--port`, `--hostname`, `--password`, `--username` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/pair.ts` |
| `pipeline <task>` | `--attempts`, `--model` | Integrated; detailed parity pending | test/verified-workflows.test.ts (plan/code/review retry) | `packages/cli/src/commands/handlers/pipeline.ts` |
| `port <commit>` | `--to`, `--apply`, `--push` | Integrated; native platforms pending | Real Git preview, root commits, patch equivalence, isolated cherry-pick, conflicts and cleanup; port/split edge suite 26 tests / 162 assertions | `packages/cli/src/commands/handlers/port.ts` |
| `proptest <file>` | `--name`, `--model` | Integrated; detailed parity pending | test/verified-workflows.test.ts (real test exits) | `packages/cli/src/commands/handlers/proptest.ts` |
| `pull <sessionID> <url>` | `--password`, `--username`, `--dir` | Integrated; V1 transport compatibility pending | Actual V2 session transfer with auth, locations and collision rejection; included in 22 tests / 158 assertions | `packages/cli/src/commands/handlers/pull.ts` |
| `push <sessionID> <url>` | `--password`, `--username`, `--dir` | Integrated; V1 transport compatibility pending | Actual V2 session transfer with auth, locations and collision rejection; included in 22 tests / 158 assertions | `packages/cli/src/commands/handlers/push.ts` |
| `rebase` | `--onto`, `--apply`, `--model` | Verified linear history; native editor pending | Original planner and real Git: 19 tests / 64 assertions, literal commit messages, dirty/concurrent checkout protection and abort | `packages/cli/src/commands/handlers/rebase.ts` |
| `refactor <instruction>` | `--test`, `--attempts`, `--model`, `--confidence`, `--self-review` | Integrated; detailed parity pending | test/refactor-command.test.ts (retained session, failure tails, exhausted attempts) | `packages/cli/src/commands/handlers/refactor.ts` |
| `resolve [file..]` | `--apply`, `--model` | Verified preview/apply | Original parser and real conflict resolution: 14 tests / 64 assertions; diff3, quoted paths, stale bytes/index, bounded reads, invalid replies | `packages/cli/src/commands/handlers/resolve.ts` |
| `resume [sessionID]` | — | Integrated; detailed parity pending | test/resume.test.ts | `packages/cli/src/commands/handlers/resume.ts` |
| `review` | `--staged`, `--branch`, `--model`, `--confidence`, `--json`, `--porcelain` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/review.ts` |
| `split` | `--apply`, `--model` | Verified preview/apply and unborn HEAD | Real Git edge suite: 26 tests / 162 assertions across port and split; index preservation, rename handling, concurrent edits and resulting commits | `packages/cli/src/commands/handlers/split.ts` |
| `stack` | `--base`, `--apply`, `--push`, `--model` | Verified preview/apply/push | Original planner and real Git: 11 tests / 42 assertions; contiguous layers, atomic branch creation, collisions and local bare-origin pushes | `packages/cli/src/commands/handlers/stack.ts` |
| `submodules` | `--sync` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/submodules.ts` |
| `tighten [files..]` | `--branch`, `--suggest`, `--model` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/tighten.ts` |
| `undo` | `--session`, `--redo` | Integrated; detailed parity pending | test/workflow-commands.test.ts (paginated revert RPC) | `packages/cli/src/commands/handlers/undo.ts` |
| `warm` | `--index` | Integrated; detailed parity pending | test/worktree-command.test.ts (index and --no-index) | `packages/cli/src/commands/handlers/warm.ts` |
| `watch <command>` | `--fix`, `--attempts`, `--model` | Integrated; native watcher pending | Actual child command and filesystem changes: 1 test / 18 assertions; failure budget, same-session repair, recovery and cancellation | `packages/cli/src/commands/handlers/watch.ts` |
| `why <question>` | `--file`, `--lines`, `--term`, `--model` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/why.ts` |
| `worktree` | `--start`, `--apply` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/worktree.ts` |
| `worktree list` | `--start`, `--apply` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/worktree.ts` |
| `worktree create [name]` | `--start`, `--apply` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/worktree.ts` |
| `worktree remove <worktree>` | `--start`, `--apply` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/worktree.ts` |
| `worktree clean` | `--start`, `--apply` | Integrated; detailed parity pending | Existing V2 handler; behavior/flag audit pending | `packages/cli/src/commands/handlers/worktree.ts` |

## Run and Mini restoration evidence

| Capability | Status | Evidence / open boundary |
| --- | --- | --- |
| Cost/token budgets, per-attempt timeout and retries | Verified transport | Real CLI/SSE fixtures preserve session IDs, budget/timeout exit codes, partial text, no retries after budget/user cancellation and failed-stop handling |
| JSON envelope, TSV porcelain and context output | Verified transport | Escaping, one-result envelope, live/projection cost deduplication and explicit schema retries; original helper tests retained |
| Output-schema loading | Integrated | Bounded 1 MiB read, schema validation and three-attempt failure behavior; full schema-dialect support is unchanged from V1's supported subset |
| Automatic primary-agent selection | Verified transport | Filters hidden/subagent entries and preserves configured default fallback |
| `bolt --mini`, `run --mini`, `run --interactive` | Integrated | Existing headless/Mini import boundaries preserved with a dispatcher; root and run route initial prompt and model/session/permission flags to Mini; no-TTY rejection precedes server startup |
| Mini files, model variants, title, thinking and replay settings | Integrated | Bounded shared attachment reader; configuration handoff verifies requested overrides and replay options; live terminal attachment/title verification remains open |
| Mini automatic permission replies | Verified transport | Root/descendant requests answered once, duplicate suppression, failures return to manual UI, forms stay interactive; 10-repeat transport/runtime passes |
| Dry-run, plan-only, pair and advanced attach/remote flags | Pending | These are still open V1 command-surface gates |

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:8da1dc25918fe28368270e9fc52ff6090644b1f4ac5e42d4fcd253b53a1c1158 -->

## Tools and services

| V1 feature | V2 implementation / required work | Status |
| --- | --- | --- |
| Browser / screenshots / interaction | Original headless `browser` text/PNG inputs, viewport, five-second rendering and 30-second deadline; isolated CDP profile and IP-pinned proxy guard every resource/redirect; configured V1 browser permissions preserved; V2 attached browser tools retained | Verified real Chromium on Linux, including ten repetitions; native browser discovery/hosts and real HTTPS matrix pending |
| Background start / output / list / kill / stdin | All five original tool names backed by approved V2 Shell/Job: bounded live/final output, repeated input, terminal states, same-session ownership and cancellation; latest 25 completed results retained | Verified Linux process/permission/cleanup fixtures and ten repetitions; native hosts pending; stdin acceptance does not guarantee child receipt |
| Git status/diff/log/show/blame | Active Git tool; permission/output/lazy-fetch tests from PR #420 | Integrated; final audit pending |
| LSP configuration and servers | Active location-scoped Content-Length transport; 38 V1 server IDs/extensions, roots, config disable/override and npm launchers; real TypeScript smoke | Verified Linux protocol/configuration; native downloaders, remaining real servers and supported hosts pending |
| Test runner | Active `test_run` uses ordinary V2 shell dispatch, permission hooks, sandbox, cancellation and structured failure parsing; 8 tests / 17 assertions | Verified synthetic commands; live model use pending |
| Coverage discovery | Active convention-based tool, actual Ripgrep and FileAccess/glob approvals, explicit bounded-result reporting; 8 tests / 19 assertions | Verified discovery; measured line coverage is not its contract |
| Diagnostics | Push/pull, dynamic identifiers, related/workspace reports, result IDs, 150 ms push settling, version filtering, file/severity output and edit/delete refresh; 48 LSP/consumer tests / 306 assertions | Verified fixtures and real TypeScript on Linux; native server matrix pending |
| LSP references / semantic rename | Original 1-based inputs and output presentation, owning-server snapshots, approved locked writes, external edit skipping with disclosure, BOM/CRLF and stale-text checks | Verified Linux tool integration and real TypeScript rename proposals; native platforms pending |
| CPU profiling | Original aggregation and frame rendering; actual Node capture through V2 shell approvals/sandbox, timeout and scratch cleanup; 10 tests / 32 assertions | Verified on Linux; native Windows/macOS pending |
| Video frames | Explicit timestamps, duration-based sampling, partial failures, readable PNGs and read/frames/shell denial; real ffmpeg fixture, 10 tests / 47 assertions | Verified on Linux; decoder availability on other hosts pending |
| Notebook read/edit/insert/delete | Active notebook tool with FileAccess and locked FileMutation; original helper contracts and permission/metadata integration tests | Verified |
| Multiedit | Active atomic preparation, one approval/write, successful-read prerequisite, V2 matcher, BOM/CRLF preservation and session isolation; included in 97 consumer tests / 431 assertions and 10-repetition new-tool suite | Existing editing contracts verified; registered LSP hook added, real multiedit/LSP workflow audit pending |
| Tasks with blockers/transitions | Active graph tools with KV, concurrency, session isolation, blocker/terminal transitions and read-only legacy graph import tested | Verified synthetic persistence; live model workflow pending |
| HTTP requests and named profiles | Original interpolation/shape helpers, real POST/redirect/denial/size/status fixtures and virtual-clock timeout; guarded IP-pinned transport and credential stripping across origins; 19 tests / 56 assertions | Verified synthetic local APIs |
| SQL inspection | Original validator/formatters, real byte-preserving read-only SQLite tests and PostgreSQL/MariaDB transactions/schema/row limits; remote write-performing function rejection | Verified SQLite on Bun/Node and PostgreSQL/MariaDB on Bun; native MySQL and other hosts pending |
| Read cache | Existing V2 read proof is active; exact V1 content-cache behavior still requires audit | Pending |
| MCP resources / semantic search / slash invocation | Active V2 tools and command API exist; exact input/output audit pending | Integrated; parity pending |
| Named checkpoints | Active save/list/rewind/remove RPC and CLI; full-project snapshots, attached conversation rewind, immutable V1 object import and collision preservation tested | Verified Linux snapshots, retained legacy sources and deleted-session marker rejection; native platforms pending |
| Undo / redo | CLI uses existing V2 session revert with filesystem restore and paginated history | Verified by actual CLI paginated history and revert transport; redo UI audit pending |
| Mutation guardrails / approvals / dry run | Retain V2 permissions and fail-closed sandbox; compare every original mutation boundary | Pending |
| Project memory / capture / session controls | Existing Bolt memory package/RPC/tools; rich project settings and model override audit | Integrated; parity pending |
| Voice | Existing V2 recording/transcription/RPC; hardware and live providers not verified | Integrated; parity pending |
| Sandbox | bwrap/seatbelt wrapper and network guard; supported-host and permission audit | Integrated; parity pending |
| Budget / notifications | Existing cost threshold UI and stop/continue; settings persistence audit | Integrated; parity pending |
| Persistent jobs / cron | One-time locked V1 imports preserve V2 collisions, source records/logs, live supervisor PID updates and removals; malformed-input and retry tests | Integrated; native Windows lifecycle verification pending |



<!-- /coderabbit-ai-generated:v1 -->## Compatibility decisions

- V2 push/pull retain V2 collision rejection rather than V1 record merging, preserving existing history. V1 remote protocol interoperability remains open. V2 service authentication retains its registered username.
- Rebase quotes commit messages literally to repair shell expansion in the V1 helper; merge-containing ranges fail explicitly because the linear plan cannot preserve merges.
- Daemon uses the V2 service registration and private credential lifecycle. Native Windows shutdown and legacy mDNS flags remain open.
- Context replay is opt-in and records native V2 requests after request hooks; its inspector also reads V1 JSON files without rewriting them. HTTP headers and credentials are excluded.
- Multiedit enforces the V1 documented read prerequisite that the old handler omitted. Successful reads persist only a session/path proof. Absolute historical read paths count; ambiguous relative paths require another read. Its replacement matching follows V2 edit behavior.
- Coverage remains filename-convention discovery, with bounded results and explicit truncation, rather than measured line coverage.
- HTTP repairs V1 credential leakage across origins and for short profile values, preserves explicit header overrides regardless of casing, and applies V2 guarded transport. URL credentials are rejected; use headers/profiles.
- SQL opens SQLite read-only, uses read-only remote transactions and limits SELECT/WITH at the server. Counts describe fetched/displayed rows, with explicit truncation. Remote-workspace SQLite file access is rejected instead of reading a same-named local file.
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:76c37a718bbf55e8ac48482212d6c333a0ea880da61ca3234a26993456d7ef74 -->

- Profiler scratch output is cleaned after completion. Successful extracted frames remain readable under unique `.bolt/tmp` directories; failed/interrupted extraction is cleaned. Both tools use ordinary V2 shell approvals and sandbox boundaries.
- Headless capture preserves original text/PNG behavior while adding a private profile and per-resource checked-IP proxy; URL credentials and metadata addresses are rejected. HTTP upgrades are rejected; HTTPS CONNECT remains browser-verified. Remote workspaces use V2 attached browser tools rather than reading a same-named local directory.
- Background tools restrict process access to the owning session (the V1 global process map did not). Completion still clears the durable notification outbox; the newest 25 consumed results remain readable in memory. Stdin reports bytes accepted by the runtime; Bun 1.4.4 cannot reliably surface a live child closing fd 0. Node callback failures propagate, and stopped/cancelled/no-stdin processes reject input.

<!-- /coderabbit-ai-generated:v1 -->

## Interaction audit

- [ ] Enumerate every V1 slash command and verify its action, argument handling, output and failure behavior.
- [ ] Compare all specialist agents, permissions, hidden/selectable state, temperatures and prompts.
- [ ] Compare keybindings, Vim input, palettes, Mini replay, attachments, cancellation and best-of-N behavior.
- [ ] Preserve V2 workflows, session data and custom themes while migrating global/project V1 configuration.
- [ ] Audit distribution, website/About labels, docs, installers, updater discovery and package/channel artifacts.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:0efd68b0467070c3916fdba4e1f4782488284d8988f9f6a8084f9a657802cbfa -->

## Current verification evidence

- Root `bun run check`: 36/36 fresh tasks passed after the browser/process and runtime-packaging restoration. Official Core, util and memory compiler checks passed.
- Browser/process/catalog/permission/Job/LSP selection: 241 tests / 1301 assertions, 23 platform/environment skips; actual LSP stdio, Shell retention/cleanup and session removal: another 23 tests / 164 assertions.
- Real Chromium text/PNG capture passed ten repetitions. Process input/cancellation and CDP failure/cancellation passed ten repetitions: 50 tests / 410 assertions.
- Memory: 234 tests / 807 assertions; restored ESM/declaration/text-prompt archive packs successfully. Codemode packed Node/workerd imports pass. Packed SDK imports pass on Node/Bun, its workerd bundle passes portability checks, and the worker boots successfully.
- SQL/checkpoint selection: 27 tests / 105 assertions, including actual PostgreSQL/MariaDB read-only transactions. Node SQLite smoke rejects writes and preserves database bytes. Sandbox/voice/process/capture consumers: 13 tests / 93 assertions. Context replay CLI/Core and Node round-trip/BOM/error/path checks pass.
- Linux x64 compiled CLI with embedded production app passed; artifact SHA256 `d9f5787b9d0d785e52cd701755e8cd83015dcca8f3ce68d0078a3a8fe19274e2`, 264337584 bytes. Compiled `--help` and `--version` pass.
- Reused for unchanged presentation inputs: browser regression 80/80 with ten repetitions and no retries; component selection 30 passes with ten repetitions; shared cloud About/light/dark and reduced-motion checks. Production menu benchmark median 124.9 ms → 119.6 ms; cold-session first-correct 407.10 ms / stable 441.60 ms, with no improvement claim.
- Native Windows/macOS execution, remaining command/settings comparisons and full terminal interaction remain outstanding. A passing checkpoint does not establish full V1 parity.



<!-- /coderabbit-ai-generated:v1 -->## Delivery gates

- [ ] Current affected package suites and required repeat tests.
- [ ] Root `bun run check` after all implementation changes.
- [ ] Production web, CLI and relevant desktop builds, including embedded fire WASM.
- [ ] Service smoke tests and real terminal visual checks.
- [ ] Shared cloud browser checks in light/dark modes and reduced motion.
- [ ] Existing Linux/Windows/browser CI failures resolved and rerun on supported hosts.
- [ ] New PR targeting `dev` with actual verification results and this checklist.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:2eef51ce9773b8be8c0f1c26c0fd04ec79729ce1bbe015e880a9ea61ba878c1e -->

The restoration remains in progress. None of the pending rows is covered by a general claim of full parity.

## Native CI repair checkpoint

The first PR #421 native run exposed fire WASM packaging in Node builds, a Drizzle glob importing the SQL tool, Windows shell quoting/path/archive problems, and assertions tied to the upstream brand/palette. Repairs preserve the database schema, user data and V2 permission paths.

- Canonical root check passed: 36 tasks, including 13 fresh checks and 23 equivalent cached checks.
- CLI repair selection passed 25 tests / 745 assertions, including actual shell commands, job descendants, Git worktrees, configuration and release archives. Windows-only branches still require native CI.
- Full lifecycle/dialog selection passed 75 TUI tests. The two lifecycle regressions also passed ten repetitions before the full selection.
- Bolt pin-board interaction/reduced motion and light/dark composer component cases passed 60 repetitions with no retries.
- Migration/SQL selection passed 46 tests / 125 assertions after naming the tool module `sql-query.ts`; no database schema or migration changed.
- Fresh production browser regressions, official dependent compilers, packed SDK, Node SEA verification and native reruns remain outstanding. A sandbox Node build generated the SEA but exited 137 before its final verification; it is not counted as a passing build.


<!-- /coderabbit-ai-generated:v1 -->


<!-- /coderabbit-ai-generated:v1 -->