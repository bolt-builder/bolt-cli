<p align="center">
  <a href="https://github.com/Bolt-builder/bolt-cli">
    <picture>
      <source srcset="images/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt CLI logo">
    </picture>
  </a>
</p>
<p align="center">⚡ オープンソースAIコーディングエージェント — OpenCodeフォーク。</p>
<p align="center">
  <a href="https://github.com/Bolt-builder/bolt-cli/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/Bolt-builder/bolt-cli/publish.yml?style=flat-square&branch=dev" /></a>
  <a href="https://github.com/Bolt-builder/bolt-cli"><img alt="GitHub" src="https://img.shields.io/github/stars/Bolt-builder/bolt-cli?style=flat-square" /></a>
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

[![Bolt CLI Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://github.com/Bolt-builder/bolt-cli)

---

## Bolt CLI

Bolt CLIは[OpenCode](https://github.com/bolt-builder/bolt-cli)のフォークです — ターミナルで動作するオープンソースのAIコーディングエージェント。コードベースを読み取り、あなたが構築しているものを理解し、より速く出荷できるよう支援します。

### インストール

```bash
# クイックインストール
curl -fsSL https://raw.githubusercontent.com/Bolt-builder/bolt-cli/dev/install | bash

# npmから
npm i -g opencode-ai@latest       # または bun/pnpm/yarn

# ソースから
git clone https://github.com/Bolt-builder/bolt-cli.git
cd bolt-cli
bun install
bun run build
```

### デスクトップアプリ (BETA)

[リリースページ](https://github.com/Bolt-builder/bolt-cli/releases)から直接ダウンロードしてください。

| プラットフォーム      | ダウンロード                   |
| --------------------- | ------------------------------ |
| macOS (Apple Silicon) | `Bolt-Desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `Bolt-Desktop-mac-x64.dmg`     |
| Windows               | `Bolt-Desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, `.AppImage`    |

### エージェント

Bolt CLIには内蔵エージェントが含まれています。`Tab`で切り替えてください。

| エージェント | アクセス | 説明                                                    |
| ------------ | -------- | ------------------------------------------------------- |
| `code`       | フル     | 開発用デフォルトエージェント — 読み取り・書き込み・実行 |
| `ask`        | 読み取り | 質問と調査 — ファイル編集不可                           |
| `plan`       | 読み取り | 分析と探索 — bashコマンド前に確認                       |

さらに `general` サブエージェント — 複雑なマルチステップタスク用。`@general`で呼び出します。

[エージェント](https://opencode.ai/docs/agents)について詳しく。

### ドキュメント

設定と使用方法については[OpenCodeドキュメント](https://opencode.ai/docs)をご覧ください。

### 貢献

貢献に興味がありますか？PRを送る前に[貢献ガイド](./CONTRIBUTING.md)をお読みください。

### クレジット

Bolt CLIは[anomalyco](https://github.com/anomalyco)による[OpenCode](https://github.com/bolt-builder/bolt-cli)のコミュニティフォークです。オリジナルの作業のすべてのクレジットはOpenCodeチームに帰属します。

---

**コミュニティ** [OpenCode Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
