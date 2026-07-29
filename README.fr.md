<p align="center">
  <a href="https://github.com/Bolt-builder/bolt-cli">
    <picture>
      <source srcset="images/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt CLI logo">
    </picture>
  </a>
</p>
<p align="center">⚡ L'agent de codage IA open source — fork d'OpenCode.</p>
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

Bolt CLI est un fork d'[OpenCode](https://github.com/anomalyco/opencode) — l'agent de codage IA open source qui tourne dans votre terminal. Il lit votre codebase, comprend ce que vous construisez et vous aide à livrer plus vite.

### Installation

```bash
# Installation rapide
curl -fsSL https://raw.githubusercontent.com/Bolt-builder/bolt-cli/dev/install | bash

# Via npm
npm i -g opencode-ai@latest       # ou bun/pnpm/yarn

# Depuis les sources
git clone https://github.com/Bolt-builder/bolt-cli.git
cd bolt-cli
bun install
bun run build
```

### Application de bureau (BETA)

Téléchargez directement depuis la [page des releases](https://github.com/Bolt-builder/bolt-cli/releases).

| Plateforme            | Téléchargement                   |
| --------------------- | -------------------------------- |
| macOS (Apple Silicon) | `Bolt-Desktop-mac-arm64.dmg`     |
| macOS (Intel)         | `Bolt-Desktop-mac-x64.dmg`       |
| Windows               | `Bolt-Desktop-windows-x64.exe`   |
| Linux                 | `.deb`, `.rpm`, ou `.AppImage`   |

### Agents

Bolt CLI inclut des agents intégrés. Passez de l'un à l'autre avec `Tab`.

| Agent   | Accès       | Description                                                  |
| ------- | ----------- | ------------------------------------------------------------ |
| `code`  | Complet     | Agent par défaut pour le développement — lit, écrit, exécute |
| `ask`   | Lecture     | Questions et recherche — pas d'édition de fichiers           |
| `plan`  | Lecture     | Analyse et exploration — demande avant les commandes bash    |

Inclus également : le sous-agent `general` pour les tâches complexes en plusieurs étapes. Invoquez-le avec `@general`.

En savoir plus sur les [agents](https://opencode.ai/docs/agents).

### Documentation

Pour la configuration et l'utilisation, consultez la [documentation OpenCode](https://opencode.ai/docs).

### Contribuer

Envie de contribuer ? Lisez notre [guide de contribution](./CONTRIBUTING.md) avant de soumettre une PR.

### Crédits

Bolt CLI est un fork communautaire d'[OpenCode](https://github.com/anomalyco/opencode) par [anomalyco](https://github.com/anomalyco). Tout le mérite du travail original revient à l'équipe OpenCode.

---

**Communauté** [OpenCode Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
