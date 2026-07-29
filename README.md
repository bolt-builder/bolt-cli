<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">The open source AI coding agent.</p>
<p align="center">
  <a href="https://boltcli.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/boltcli-ai"><img alt="npm" src="https://img.shields.io/npm/v/boltcli-ai?style=flat-square" /></a>
  <a href="https://github.com/Bolt-builder/bolt-cli/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/Bolt-builder/bolt-cli/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![Bolt CLI Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://boltcli.ai)

---

### Installation

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# Package managers
npm i -g boltcli-ai@latest        # or bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS and Linux (recommended, always up to date)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # Any OS
nix run nixpkgs#bolt              # or github:Bolt-builder/bolt-cli for latest dev branch
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

### Desktop App (BETA)

Bolt CLI is also available as a desktop application. Download directly from the [releases page](https://github.com/Bolt-builder/bolt-cli/releases) or [boltcli.ai/download](https://boltcli.ai/download).

| Platform              | Download                       |
| --------------------- | ------------------------------ |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`     |
| Windows               | `bolt-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, or `.AppImage` |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Installation Directory

The install script respects the following priority order for the installation path:

1. `$BOLT_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if it exists or can be created)
4. `$HOME/.bolt/bin` - Default fallback

```bash
# Examples
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Agents

Bolt CLI includes built-in agents you can switch between with the `Tab` key.

- **code** - Default, full-access agent for development work
- **ask** - Read-only agent for questions and information gathering
  - Blocks file edits by default
  - Ideal for exploring unfamiliar codebases or asking questions
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://boltcli.ai/docs/agents).

### Documentation

For more info on how to configure Bolt CLI, [**head over to our docs**](https://boltcli.ai/docs).

### Contributing

If you're interested in contributing to Bolt CLI, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on Bolt

If you are working on a project that's related to Bolt CLI and is using "bolt" as part of its name, for example "bolt-dashboard" or "bolt-mobile", please add a note to your README to clarify that it is not built by the Bolt CLI team and is not affiliated with us in any way.

---

**Join our community** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
