<p align="center">
  <a href="https://github.com/Bolt-builder/bolt-cli">
    <picture>
      <source srcset="images/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt CLI logo">
    </picture>
  </a>
</p>
<p align="center">⚡ Der Open-Source KI-Coding-Agent — geforked von OpenCode.</p>
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

Bolt CLI ist ein Fork von [OpenCode](https://github.com/anomalyco/opencode) — dem Open-Source KI-Coding-Agenten, der in deinem Terminal läuft. Er liest deine Codebasis, versteht, woran du baust, und hilft dir, schneller zu shippen.

### Installation

```bash
# Schnellinstallation
curl -fsSL https://raw.githubusercontent.com/Bolt-builder/bolt-cli/dev/install | bash

# Via npm
npm i -g opencode-ai@latest       # oder bun/pnpm/yarn

# Aus dem Source
git clone https://github.com/Bolt-builder/bolt-cli.git
cd bolt-cli
bun install
bun run build
```

### Desktop-App (BETA)

Direkt von der [Release-Seite](https://github.com/Bolt-builder/bolt-cli/releases) herunterladen.

| Plattform             | Download                         |
| --------------------- | -------------------------------- |
| macOS (Apple Silicon) | `Bolt-Desktop-mac-arm64.dmg`     |
| macOS (Intel)         | `Bolt-Desktop-mac-x64.dmg`       |
| Windows               | `Bolt-Desktop-windows-x64.exe`   |
| Linux                 | `.deb`, `.rpm`, oder `.AppImage` |

### Agenten

Bolt CLI enthält integrierte Agenten. Wechsle zwischen ihnen mit `Tab`.

| Agent   | Zugriff | Beschreibung                                               |
| ------- | ------- | ---------------------------------------------------------- |
| `code`  | Voll    | Standard-Agent für Entwicklung — liest, schreibt, führt aus |
| `ask`   | Lesen   | Fragen & Recherche — keine Dateiänderungen erlaubt          |
| `plan`  | Lesen   | Analyse & Exploration — fragt vor Bash-Befehlen             |

Außerdem enthalten: `general`-Subagent für komplexe, mehrstufige Aufgaben. Aufruf mit `@general`.

Mehr über [Agenten](https://opencode.ai/docs/agents) erfahren.

### Dokumentation

Für Konfiguration und Nutzung siehe die [OpenCode-Dokumentation](https://opencode.ai/docs).

### Mitmachen

Interesse an Beiträgen? Lies unseren [Contributing-Guide](./CONTRIBUTING.md) vor dem Einreichen eines PRs.

### Credits

Bolt CLI ist ein Community-Fork von [OpenCode](https://github.com/anomalyco/opencode) von [anomalyco](https://github.com/anomalyco). Alle Credits für die ursprüngliche Arbeit gebühren dem OpenCode-Team.

---

**Community** [OpenCode Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
