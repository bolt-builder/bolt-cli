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

`dev` tracks upstream OpenCode V2 (`anomalyco/opencode`, branch `dev`) plus the Bolt overlay: the `bolt` command, Bolt branding, the AGPL-3.0 license, and Bolt's release and repository automation.

The latest published release is [v1.21.0](https://github.com/bolt-builder/bolt-cli/releases/tag/v1.21.0). It was built from the V1 codebase (`packages/opencode`), which upstream retired in favor of V2. That codebase, and the Bolt features written against it (blast radius, project memory, the extra agents and CLI commands, and more), now live in [`legacy/`](./legacy/README.md). They are kept intact for porting onto V2 and are not part of the current build.

## Install

```bash
# Latest release (macOS / Linux)
curl -fsSL https://raw.githubusercontent.com/bolt-builder/bolt-cli/dev/install | bash
```

Desktop builds for macOS, Windows, and Linux are on the [releases page](https://github.com/bolt-builder/bolt-cli/releases).

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

`packages/cli` ships three entry points that start the same CLI: `bolt`, `opencode`, and `opencode2`. Configuration files and environment variables keep their upstream names (`opencode.json`, `.opencode/`, `OPENCODE_*`), so existing OpenCode configuration works unchanged.

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
