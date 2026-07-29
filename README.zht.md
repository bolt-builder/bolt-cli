<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">開源的 AI 程式開發代理。</p>
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

### 安裝

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# 套件管理器
npm i -g boltcli-ai@latest        # 或 bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS 和 Linux（推薦，始終最新）
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # 任何作業系統
nix run nixpkgs#bolt              # 或 github:Bolt-builder/bolt-cli 獲取最新 dev 分支
```

> [!TIP]
> 安裝前請移除早於 0.1.x 的版本。

### 桌面應用 (BETA)

Bolt CLI 也可作為桌面應用使用。直接從[發布頁面](https://github.com/Bolt-builder/bolt-cli/releases)或 [boltcli.ai/download](https://boltcli.ai/download) 下載。

| 平台                  | 下載                             |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`、`.rpm` 或 `.AppImage`   |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### 安裝目錄

安裝腳本遵循以下安裝路徑優先級：

1. `$BOLT_INSTALL_DIR` - 自訂安裝目錄
2. `$XDG_BIN_DIR` - 符合 XDG Base Directory 規範的路徑
3. `$HOME/bin` - 標準使用者二進位目錄（如果存在或可建立）
4. `$HOME/.bolt/bin` - 預設回退

```bash
# 範例
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### 代理

Bolt CLI 包含內建代理，可使用 `Tab` 鍵切換。

- **code** - 預設的完全存取代理，用於開發工作
- **ask** - 唯讀代理，用於提問和資訊收集
  - 預設阻止檔案編輯
  - 非常適合探索不熟悉的程式碼庫或提問
- **plan** - 唯讀代理，用於分析和程式碼探索
  - 預設拒絕檔案編輯
  - 執行 bash 指令前請求許可
  - 非常適合規劃變更

還包含一個 **general** 子代理，用於複雜搜尋和多步驟任務。
該代理在內部使用，可透過在訊息中使用 `@general` 呼叫。

了解更多關於[代理](https://boltcli.ai/docs/agents)的資訊。

### 文件

有關如何設定 Bolt CLI 的更多資訊，[**請查看我們的文件**](https://boltcli.ai/docs)。

### 參與貢獻

如果您有興趣為 Bolt CLI 做出貢獻，請在提交 pull request 前閱讀我們的[貢獻文件](./CONTRIBUTING.md)。

### 基於 Bolt 構建

如果您正在開發與 Bolt CLI 相關的專案，並在名稱中使用 "bolt"，例如 "bolt-dashboard" 或 "bolt-mobile"，請在您的 README 中新增說明，澄清該專案並非由 Bolt CLI 團隊構建且與我們無關。

---

**加入我們的社群** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
