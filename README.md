<p align="center">
  <a href="https://github.com/bolt-builder/bolt-cli">
    <img width="576" height="186" alt="Bolt" src="https://github.com/user-attachments/assets/05ada17d-5f43-4ed8-9696-3fc84e46f066" />
  </a>
</p>

<p align="center">Your terminal, now with a full AI engineering team inside it.</p>

<p align="center">
  <a href="https://github.com/bolt-builder/bolt-cli/actions/workflows/check-test.yml"><img alt="Tests" src="https://img.shields.io/github/actions/workflow/status/bolt-builder/bolt-cli/check-test.yml?style=flat-square&branch=dev&label=tests" /></a>
  <a href="https://github.com/bolt-builder/bolt-cli/actions/workflows/check.yml"><img alt="Typecheck" src="https://img.shields.io/github/actions/workflow/status/bolt-builder/bolt-cli/check.yml?style=flat-square&branch=dev&label=typecheck" /></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square" /></a>
</p>

<p align="center">
<img width="640" height="360" alt="Demo" src="./images/demo.gif" />
</p>

---

Bolt is a terminal-first AI coding agent built on the [OpenCode](https://github.com/anomalyco/opencode) V2 engine: a keyboard-driven TUI, a headless server with an HTTP API, a web UI, a desktop app, MCP servers with OAuth, plugins, and agent sessions you can detach from and re-attach to.

## Status

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:02784b777cf0c37d48f9258b3f5fe3735d7f69a78ab7ead6df1856c00958b14b -->

Bolt uses the OpenCode V2 engine while restoring the original Bolt identity and workflows. The active workspace includes Bolt branding, themes and terminal effects, project memory, voice, sandbox controls, extra agents and CLI commands.

Restoration is in progress. [The parity checklist](legacy/V1-PARITY.md) and [interaction inventory](legacy/V1-SURFACES.md) distinguish tested behavior from remaining work. The pre-sync V1 commit is the reference; archived source in `legacy/` is excluded from production builds.

<!-- /coderabbit-ai-generated:v1 -->
## Install

```bash
# Latest release (macOS / Linux)
curl -fsSL https://raw.githubusercontent.com/bolt-builder/bolt-cli/dev/install | bash
```

Desktop builds for macOS, Windows, and Linux are on the [releases page](https://github.com/bolt-builder/bolt-cli/releases).

## Custom subagents

Ask Bolt to create a subagent, or create `.bolt/subagent/<name>.md` in your project. The filename is the subagent name; YAML frontmatter sets its description and optional model or permissions, and the Markdown body provides its instructions. For example, `.bolt/subagent/api-reviewer.md`:

```md
---
description: Review API changes for compatibility
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: shell
    resource: "*"
    effect: deny
---
Review API changes for breaking behavior and report actionable findings.
```

These files always define subagents, not primary agents. They use normal agent permissions unless overridden; a prompt alone does not restrict tools. New and edited definitions are reloaded automatically, and can be requested by name. Optional `model` uses `provider/model` (or `provider/model#variant`). Built-in specialists include `reviewer` and `security-auditor` for review, `bug-hunter` and `security-fixer` for finding and fixing issues, and `debugger` and `documentation` for focused tasks.

## Develop

Bolt requires the Bun version pinned in `package.json`.

```bash
bun install
bun dev          # V2 CLI and TUI on this checkout
bun dev .        # open this repository in the TUI
bun run check    # lint and typecheck
```

Run tests from a package directory, never from the repository root:

```bash
cd packages/core && bun run test
```

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:34607b63a7a1fa6fd0ed8a00e11a55dd6ac183ab34505030e70cb4afcd0141de -->

`packages/cli` ships three entry points that start the same CLI: `bolt`, `opencode`, and `opencode2`. Existing `opencode.json`, `.opencode/` and `OPENCODE_*` configuration remains supported. Bolt configuration names and selected `BOLT_*` aliases are also recognized; explicit V2 environment settings take precedence. V1 history, credentials, appearance preferences and background-job metadata are imported without deleting their source data. See the parity checklist for migration coverage and remaining compatibility checks.

<!-- /coderabbit-ai-generated:v1 -->

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [AGENTS.md](./AGENTS.md) for the development workflow and style guide.

## Syncing upstream

`dev` records `anomalyco/opencode` `dev` as a merge parent. To pull new upstream work:

```bash
git remote add upstream https://github.com/anomalyco/opencode.git
git fetch upstream dev
git merge upstream/dev
```

Workspace packages keep their upstream `@opencode/*` names so upstream merges apply cleanly. Keep Bolt-specific changes to upstream files small and listed in [`legacy/README.md`](./legacy/README.md#bolt-overlay-on-upstream-files).

## License

Bolt is licensed under [AGPL-3.0](./LICENSE). It incorporates OpenCode, which is MIT licensed; see [CREDITS](./CREDITS).
