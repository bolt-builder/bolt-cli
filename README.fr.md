<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">L'agent de codage IA open source.</p>
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

# Gestionnaires de paquets
npm i -g boltcli-ai@latest        # ou bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS et Linux (recommandé, toujours à jour)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # N'importe quel OS
nix run nixpkgs#bolt              # ou github:Bolt-builder/bolt-cli pour la branche dev la plus récente
```

> [!TIP]
> Supprimez les versions antérieures à 0.1.x avant d'installer.

### Application de bureau (BETA)

Bolt CLI est aussi disponible en application de bureau. Téléchargez-la directement depuis la [page des releases](https://github.com/Bolt-builder/bolt-cli/releases) ou [boltcli.ai/download](https://boltcli.ai/download).

| Plateforme            | Téléchargement                  |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm`, ou `.AppImage`  |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Répertoire d'installation

Le script d'installation respecte l'ordre de priorité suivant pour le chemin d'installation :

1. `$BOLT_INSTALL_DIR` - Répertoire d'installation personnalisé
2. `$XDG_BIN_DIR` - Chemin conforme à la spécification XDG Base Directory
3. `$HOME/bin` - Répertoire binaire utilisateur standard (s'il existe ou peut être créé)
4. `$HOME/.bolt/bin` - Repli par défaut

```bash
# Exemples
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Agents

Bolt CLI inclut des agents intégrés que vous pouvez alterner avec la touche `Tab`.

- **code** - Agent par défaut avec accès complet pour le travail de développement
- **ask** - Agent en lecture seule pour poser des questions et recueillir des informations
  - Bloque les modifications de fichiers par défaut
  - Idéal pour explorer des bases de code inconnues ou poser des questions
- **plan** - Agent en lecture seule pour l'analyse et l'exploration de code
  - Refuse les modifications de fichiers par défaut
  - Demande l'autorisation avant d'exécuter des commandes bash
  - Idéal pour planifier des changements

Un sous-agent **general** est aussi inclus pour les recherches complexes et les tâches en plusieurs étapes.
Il est utilisé en interne et peut être invoqué via `@general` dans les messages.

En savoir plus sur les [agents](https://boltcli.ai/docs/agents).

### Documentation

Pour plus d'informations sur la configuration de Bolt CLI, [**consultez notre documentation**](https://boltcli.ai/docs).

### Contribuer

Si vous souhaitez contribuer à Bolt CLI, lisez notre [documentation de contribution](./CONTRIBUTING.md) avant de soumettre une pull request.

### Construire avec Bolt

Si vous travaillez sur un projet lié à Bolt CLI et que vous utilisez "bolt" dans le nom du projet (par exemple, "bolt-dashboard" ou "bolt-mobile"), ajoutez une note dans votre README pour préciser qu'il n'est pas construit par l'équipe Bolt CLI et qu'il n'est pas affilié à nous.

---

**Rejoignez notre communauté** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
