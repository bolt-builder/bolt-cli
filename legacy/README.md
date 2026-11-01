# Legacy Bolt V1 code

This directory keeps Bolt code that does not build against the current upstream OpenCode V2 engine. Nothing here is a workspace package: Bun, Turbo, TypeScript, and oxlint ignore it. It is kept so features can be ported onto V2 one at a time, with tests, instead of being lost.

## Why it moved

Bolt v1.21.0 was built from `packages/opencode`, the V1 CLI. Upstream deleted that package when it moved to V2 (`packages/cli`, `packages/core`, `packages/server`). Later upstream merges into Bolt were resolved with `-X ours`, which mixed V1 and V2 files and left `dev` unable to install dependencies, typecheck, test, or build. CI had been red since September 2026.

The upstream sync that created this directory rebuilt the tree on upstream `dev` and moved every Bolt-authored file that targets the V1 code here, at its original path under `legacy/`.

The complete pre-sync tree, including the V1 base files that upstream deleted, is commit `0cae319f4f7065f0bcd4335a579033dac706b7d0`. The last tree before the `-X ours` merge is `d7c0541e0f`.

## Contents

| Path | What it is |
| ---- | ---------- |
| `packages/opencode/` | The Bolt V1 CLI and server (`bolt` package, v1.20.7): blast radius, checkpoints, guardrails, file protection, approvals, background jobs, voice, project memory integration, and the V1 test suite. |
| `packages/memory/` | Project memory and cross-session recall. |
| `packages/cli/src/commands/handlers/` | V1 command handlers (`ask`, `blast`, `commit`, `review`, `memory`, `worktree`, and about 60 more) that were copied into the V2 CLI without being registered. |
| `packages/cli/script/` | Startup benchmark and man page generator for the V1 CLI. |
| `packages/core/src/tool/` | Extra agent tools (background processes, browser, coverage, git, HTTP, LSP rename and references, memory, multiedit, notebook, SQL, tasks, test runner, semantic search). |
| `packages/core/src/` | Network guard, redaction, sandbox, and an unregistered session index migration. |
| `packages/tui/` | Vim mode, spoken answers and voice input, arena and best-of-N runs, budgets, memory dialog, session sidebar, and the Bolt TUI theme. |
| `packages/app/` | Gateway catalog settings and a vendored client build. |
| `docs/` | Command reference and guides for the V1 CLI. |
| `.github/workflows/` | Workflows that run V1 scripts (`startup.yml`) or the removed GitHub action (`bolt.yml`). |
| `nix/bolt.nix`, `script/docs-reference.ts` | V1 packaging and docs generation. |

## Porting a feature

1. Find the V2 home for it (`packages/core` for tools and services, `packages/cli/src/commands` for commands, `packages/tui` for TUI features).
2. Rewrite it against V2 APIs. Most V1 modules import from `@/…` paths and V1 services that no longer exist.
3. Bring its tests along and run them from the package directory.
4. Delete the ported files from `legacy/` in the same change.

## Bolt overlay on upstream files

These upstream files carry Bolt-specific changes. Re-check them after each upstream merge.

| File | Change |
| ---- | ------ |
| `README.md`, `LICENSE`, `SECURITY.md` | Bolt README, AGPL-3.0 license, Bolt security contact. |
| `install` | Installs Bolt releases from `bolt-builder/bolt-cli`. |
| `packages/cli/package.json`, `packages/cli/bin/bolt.cjs`, `bun.lock` | Adds the `bolt` command. |
| `.oxlintrc.json` | Ignores `legacy/**`. |
| `.github/workflows/deploy.yml` | Deploys only from `bolt-builder/bolt-cli` when `AWS_DEPLOY_ROLE_ARN` is set. |
| `.github/actions/setup-git-committer/action.yml` | Optional custom git identity. |
| `.github/ISSUE_TEMPLATE/bug-report.yml`, `script/github/close-issues.ts`, `script/github/close-prs.ts` | Bolt names and repository. |
| `infra/stage.ts`, `infra/stats.ts` | Bolt domains and stack names. |

Upstream files that Bolt deletes: the translated `README.*.md` files, `sdks/vscode/`, and six commands in `.opencode/command/`.
