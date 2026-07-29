<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">开源的 AI 编程代理。</p>
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

### 安装

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# 包管理器
npm i -g boltcli-ai@latest        # 或 bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS 和 Linux（推荐，始终最新）
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # 任何操作系统
nix run nixpkgs#bolt              # 或 github:Bolt-builder/bolt-cli 获取最新 dev 分支
```

> [!TIP]
> 安装前请移除早于 0.1.x 的版本。

### 桌面应用 (BETA)

Bolt CLI 也可作为桌面应用使用。直接从[发布页面](https://github.com/Bolt-builder/bolt-cli/releases)或 [boltcli.ai/download](https://boltcli.ai/download) 下载。

| 平台                  | 下载                             |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`、`.rpm` 或 `.AppImage`   |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### 安装目录

安装脚本遵循以下安装路径优先级：

1. `$BOLT_INSTALL_DIR` - 自定义安装目录
2. `$XDG_BIN_DIR` - 符合 XDG Base Directory 规范的路径
3. `$HOME/bin` - 标准用户二进制目录（如果存在或可创建）
4. `$HOME/.bolt/bin` - 默认回退

```bash
# 示例
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### 代理

Bolt CLI 包含内置代理，可使用 `Tab` 键切换。

- **code** - 默认的完全访问代理，用于开发工作
- **ask** - 只读代理，用于提问和信息收集
  - 默认阻止文件编辑
  - 非常适合探索不熟悉的代码库或提问
- **plan** - 只读代理，用于分析和代码探索
  - 默认拒绝文件编辑
  - 运行 bash 命令前请求许可
  - 非常适合规划变更

还包含一个 **general** 子代理，用于复杂搜索和多步骤任务。
该代理在内部使用，可通过在消息中使用 `@general` 调用。

了解更多关于[代理](https://boltcli.ai/docs/agents)的信息。

### 文档

有关如何配置 Bolt CLI 的更多信息，[**请查看我们的文档**](https://boltcli.ai/docs)。

### 参与贡献

如果您有兴趣为 Bolt CLI 做出贡献，请在提交 pull request 前阅读我们的[贡献文档](./CONTRIBUTING.md)。

### 基于 Bolt 构建

如果您正在开发与 Bolt CLI 相关的项目，并在名称中使用 "bolt"，例如 "bolt-dashboard" 或 "bolt-mobile"，请在您的 README 中添加说明，澄清该项目并非由 Bolt CLI 团队构建且与我们无关。

---

**加入我们的社区** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
