<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">オープンソースのAIコーディングエージェント。</p>
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

### インストール

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# パッケージマネージャー
npm i -g boltcli-ai@latest        # または bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS と Linux（推奨、常に最新）
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # 任意のOS
nix run nixpkgs#bolt              # または github:Bolt-builder/bolt-cli で最新のdevブランチ
```

> [!TIP]
> インストール前に0.1.xより古いバージョンを削除してください。

### デスクトップアプリ (BETA)

Bolt CLIはデスクトップアプリとしても利用できます。[リリースページ](https://github.com/Bolt-builder/bolt-cli/releases)から直接ダウンロードするか、[boltcli.ai/download](https://boltcli.ai/download)を利用してください。

| プラットフォーム      | ダウンロード                    |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`、`.rpm`、または `.AppImage` |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### インストールディレクトリ

インストールスクリプトは、以下の優先順位でインストールパスを決定します：

1. `$BOLT_INSTALL_DIR` - カスタムインストールディレクトリ
2. `$XDG_BIN_DIR` - XDG Base Directory仕様に準拠したパス
3. `$HOME/bin` - 標準ユーザーバイナリディレクトリ（存在するか作成可能な場合）
4. `$HOME/.bolt/bin` - デフォルトのフォールバック

```bash
# 例
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### エージェント

Bolt CLIには組み込みエージェントが含まれており、`Tab`キーで切り替えられます。

- **code** - 開発作業用のデフォルトのフルアクセスエージェント
- **ask** - 質問と情報収集のための読み取り専用エージェント
  - デフォルトでファイル編集をブロック
  - 未知のコードベースの探索や質問に最適
- **plan** - 分析とコード探索のための読み取り専用エージェント
  - デフォルトでファイル編集を拒否
  - bashコマンドの実行前に許可を要求
  - 変更の計画に最適

複雑な検索とマルチステップタスクのための**general**サブエージェントも含まれています。
これは内部的に使用され、メッセージで`@general`を使用して呼び出すことができます。

[エージェント](https://boltcli.ai/docs/agents)について詳しく見る。

### ドキュメント

Bolt CLIの設定方法の詳細については、[**ドキュメントをご覧ください**](https://boltcli.ai/docs)。

### 貢献

Bolt CLIへの貢献に興味がある場合は、プルリクエストを送信する前に[貢献ドキュメント](./CONTRIBUTING.md)をお読みください。

### Boltの上に構築する

Bolt CLIに関連するプロジェクトに取り組んでいて、名前に"bolt"を含めている場合（例：「bolt-dashboard」や「bolt-mobile」）、Bolt CLIチームによって構築されたものではなく、私たちとは一切関係がないことを明記する注記をREADMEに追加してください。

---

**コミュニティに参加** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
