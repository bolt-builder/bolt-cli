# Changelog

All notable changes to the Bolt VS Code extension are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

### Added

- Open Bolt command (`Cmd+Esc` / `Ctrl+Esc`) that launches the Bolt CLI in a split terminal or focuses the running one, and Open Bolt in a new tab (`Cmd+Shift+Esc` / `Ctrl+Shift+Esc`) that always starts a fresh terminal.
- Add Filepath to Terminal command (`Cmd+Alt+K` / `Ctrl+Alt+K`) that inserts a reference to the active file, with the selected line range, into the Bolt prompt.
- Sidebar chat: a Bolt view in the activity bar that starts `bolt serve` for your workspace (or attaches to `bolt.server.url`), streams responses live, supports Stop mid-stream and New session, and keeps the transcript when the sidebar is hidden.
- Add Filepath to Bolt Chat command in the editor context menu.
- Settings: `bolt.path`, `bolt.args`, `bolt.terminal.reuse`, and `bolt.server.url`.
- Bolt output channel with binary resolution and backend diagnostics.
- Multi-root workspaces: Open Bolt asks which folder to use and remembers the last choice.
- Clear error notifications with install and settings shortcuts when the Bolt CLI is not found.
