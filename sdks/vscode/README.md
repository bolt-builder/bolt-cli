# Bolt for VS Code

Run the [Bolt](https://github.com/bolt-builder/bolt-cli) AI coding agent inside VS Code: launch it in a split terminal and send file references to it without leaving your editor. Bolt is self-hosted, bring-your-own-key, and open source; this extension is a thin client of the CLI you already have and makes no network calls of its own.

## Features

- **Open Bolt** (`Cmd+Esc` on Mac, `Ctrl+Esc` on Windows/Linux): opens Bolt in a split terminal, or focuses the existing Bolt terminal if one is already running.
- **Open Bolt in a new tab** (`Cmd+Shift+Esc` / `Ctrl+Shift+Esc`, or the Bolt button in the editor title bar): always starts a fresh Bolt terminal.
- **Add Filepath to Terminal** (`Cmd+Alt+K` / `Ctrl+Alt+K`): inserts a reference to the active file into the Bolt prompt, for example `@src/extension.ts#12-40` when lines 12 to 40 are selected.

## Requirements

The `bolt` CLI must be installed and on your PATH. See the [Bolt repository](https://github.com/bolt-builder/bolt-cli) for installation instructions. If the CLI is missing, the extension shows a notification with a link to the install docs instead of failing silently.

## Extension Settings

This extension currently contributes no settings. Configuration for the CLI path and terminal behavior is planned.

## Known Limitations

- The file reference is typed into the Bolt terminal prompt; it is not sent while Bolt is busy generating a response.
- Screenshots are not yet included in this README. TODO: add screenshots of the terminal integration.

## Publishing note

The `publisher` field in `package.json` is a placeholder. Before the first Marketplace publish, a maintainer must create the `bolt-builder` publisher (or another name) on the Visual Studio Marketplace and update the field if the final name differs.

## Development

1. `code sdks/vscode` - Open the `sdks/vscode` directory in VS Code. **Do not open from repo root.**
2. `bun install` - Run inside the `sdks/vscode` directory.
3. Press `F5` to start debugging - This launches a new VS Code window with the extension loaded.

To package a `.vsix` locally, run `./script/package` from `sdks/vscode`.

## License

AGPL-3.0-only. See [LICENSE](./LICENSE).
