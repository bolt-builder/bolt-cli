<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:84ed9dae9c34e83201deaf7d3008db596546dca2aaf9d7b75e8ad8ab57a4e059 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:c9503e735893dbf91bf1a1388dbb7a57ad20d83e896982b8ed094383d23670ee -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ceee84d09f455e81bee26fb1e6e804d4c5517ac74b70fda966d221a9130dc17d -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:7b5a34b33cbecabfa10531130969e930424e36ed09d3184814fa8a07de0159f2 -->

# V1 to V2 port status — issue #419

The full port remains in progress. V1 code under `legacy/` is excluded from the active workspace. A command registration or slash name alone does not establish behavioral parity. Legacy implementations are removed only after their V2 integration is exercised.

## Integrated features

| Area | Current V2 integration | Verified coverage |
| --- | --- | --- |
| Bolt identity | Original CLI dollar-sign wordmark, compact B, original shared SVG artwork, desktop channel icons, web icons, titles, About wordmark and repository link | Renderer and icon tests; browser About and light/dark persistence checks |
| Bolt theme | Original light/dark palette, default selection, semantic token migration and custom theme preservation | TUI theme/migration tests; browser computed backgrounds and reload persistence |
| Agents and TUI commands | Original specialist prompts, 44 original slash names, Vim input, plan/agent restoration, autoapproval, sidebar, worktree alias | Agent permission/config and TUI action/input tests; full semantic audit still required |
| Memory | Active `@bolt-ai/memory`, canonical project identity, recall/save tools, session capture, redaction, learning and eight management subcommands | Memory package suite, Core integration and CLI consumer tests; rich memory settings/model override remain pending |
| Voice | Recorder lifecycle, WAV validation, local whisper.cpp first, configured OpenAI fallback, TUI append and `run --voice` | Synthetic recorder/transcription/RPC tests; physical microphone and live provider not tested |
| Sandbox and protection | V1 bwrap/seatbelt process guard, session controls, network/DNS/redirect guard, model/log/crash credential redaction | Real bwrap write containment, Core process/voice/network and redaction tests; broader V1 mutation protections remain pending |
| Code and Git search | Original semantic ranking, incremental index/query/watch and Git status/diff/log/blame/show tool through V2 permissions and workspace processes | Original parser/ranker contracts, real index/watch fixtures and real Git query/permission checks |
| Jobs and budgets | Core job RPC, process list/output/cancel UI, original cost threshold and continue/stop behavior | Job, TUI command and cost threshold tests; persistent standalone supervisor supports health checks, restart limits, log tail and termination |
| Distribution | Bolt npm names and wrappers, archive names and members, signed packaging paths, GitHub release feeds, Homebrew/Docker destinations, compatible V2 updater discovery, Scoop/Chocolatey detection | Real pack/postinstall fixtures, updater tests, mocked publication guards, real Linux standalone build/service/web smoke; native signing and live publishing untested |

## Integrated CLI commands

The following V1 command families use active V2 specifications and lazy handlers:

- Reports: `blast`, `hotspots`, `dead`, `dupes`, `packages`, `map`, `arch`, `owners`, `deps`, `drift`, `commitlint`, `asserts`, `tighten`, `analyze`.
- Agent execution: `ask`, `commit`, `review`, `diff-gate`, `why`, `learn`, `invariants`.
- Transcripts: `grep`, top-level `export` and `session export` with Markdown, HTML replay, JSON, JSONL and porcelain output.
- Memory: `export`, `import`, `team`, `diff`, `review`, `search`, `conflicts`, `why` under `memory`.
- Sessions: fuzzy `resume` and inclusive-anchor `fork` using V2 interactive settings/keybindings.
- Local utilities: `alias` management and expansion; `logs` history/filter/follow/JSON/porcelain; `index` refresh/query/watch; `flaky` repeat/quarantine; `bench` comparison; `submodules` report/sync; original `init` presets; persistent `jobs` and `cron` scheduling.

Pure V1 algorithms retain their original contract tests. Git and process operations use the V2 local process services; server-owned behavior uses the V2 client. One-shot agent sessions reject interactive permission requests and clean up on completion or interruption.

### Compatibility notes

- Session JSON and JSONL use the current V2 message schema. Presentation formats adapt V2 messages to the original renderers.
- HTML export now honors the requested sanitizer, matching the existing other-format contract; V1 incorrectly rendered raw data for HTML.
- New global aliases are saved through the locked V2 `cli.json` configuration service. Legacy and project Bolt/opencode aliases are read, with nearest project precedence. Removing an alias owned only by a project or legacy file reports that owner instead of falsely claiming to remove it through a different global file.
- Inclusive V1 fork anchors map to exclusive V2 boundaries with the next message, including across pages. Empty-session restrictions remain intact; TTY preflight precedes interactive fork mutation.
- Bolt project config names and `.bolt` directories now load alongside current V2 names. Bolt sources override matching-location compatibility sources; relative V2 ordering and managed-policy authority remain intact. Full legacy global-directory migration remains pending.
- Redaction options and their deprecated alias survive normalization, including false values.
- Log defaults follow the existing V2 channel-specific log path. `--file` can select another log. Read failures and search failures are reported instead of being presented as clean results.
- Automatic updater discovery excludes legacy V1 product releases. Existing V2 rollback behavior and explicit version installations remain supported. No V2 release has been published by this task.
- Stable releases keep the existing reviewed-notes, restricted-role, deploy-key tagging, artifact checksum/signature and npm provenance gates. Preview GitHub releases also require verified tags from the deploy-key route. Upstream-only AUR/WinGet publishing jobs were removed; they were absent from the original V1 distribution contract.

## Remaining integration and audit

| Area | Work remaining |
| --- | --- |
| CLI | Port or prove an active V2 equivalent for every remaining legacy handler listed below; include command flags and exit/output behavior |
| Core tools | Port or map original Git, browser, background/stdin/output, LSP, coverage/diagnostics/profile, notebook/multiedit and task/test tools |
| Mutation safety | Integrate checkpoints/undo, full guardrails/protection/approval/dry-run behavior at the V2 execution boundaries |
| Persistent background control | Audit persistent supervisor control-plane behavior and legacy state migration |
| TUI and settings | Complete rich memory/project settings and model override; audit semantics of all original slash commands against V1 |
| Configuration and docs | Complete V1 configuration discovery/migration, legacy global configuration directories and remaining app/docs/nix/deployment consumers |
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:017dbb0cd3e22f014f16ab85e0b13fc4c2c1f1f8fd067e8ab77c6998b7c0cc55 -->

| Validation and delivery | Run affected gates after each integration, complete the remaining parity audit and visual checks, and add verified changes to PR #420 |

<!-- /coderabbit-ai-generated:v1 -->

Remaining legacy CLI handler files (this is an audit queue; existing V2 equivalents must be checked before copying):

`arena`, `batch`, `bisect`, `checkpoint`, `codemod`, `config/diff`, `config/doctor`, `config/edit`, `config/editor`, `config/index`, `daemon`, `debug/context`, `doctor`, `eval/case`, `eval`, `exec`, `figma`, `guard`, `mutate`, `mux`, `pipeline`, `port`, `proptest`, `pull`, `push`, `rebase`, `refactor`, `resolve`, `split`, `stack`, `undo`, `warm`, `watch`, `worktree`.

## Validation environment

The declared Bun 1.4.4 is installed task-locally and the canonical root `bun run check` has passed. Earlier Bun 1.4.2 and parallel compiler limitations are superseded. New source changes require current checks; the detailed validation record lives in workspace context outside repository commits. Real Linux standalone CLI compilation, embedded web assets, service election/authentication/plugin loading/shutdown, and npm package/archive/postinstall fixtures have passed. macOS/Windows builds, native signing, physical recording and live providers have not been exercised.

The user opened [PR #420](https://github.com/bolt-builder/bolt-cli/pull/420). Full V1 parity and the remaining audit are still in progress.







<!-- /coderabbit-ai-generated:v1 --><!-- /coderabbit-ai-generated:v1 --><!-- /coderabbit-ai-generated:v1 --><!-- /coderabbit-ai-generated:v1 -->