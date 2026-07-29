<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">Der Open-Source KI-Coding-Agent.</p>
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

# Paketmanager
npm i -g boltcli-ai@latest        # oder bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS und Linux (empfohlen, immer aktuell)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # Jedes OS
nix run nixpkgs#bolt              # oder github:Bolt-builder/bolt-cli für den neuesten dev-Branch
```

> [!TIP]
> Entfernen Sie Versionen älter als 0.1.x vor der Installation.

### Desktop-App (BETA)

Bolt CLI ist auch als Desktop-Anwendung verfügbar. Laden Sie sie direkt von der [Releases-Seite](https://github.com/Bolt-builder/bolt-cli/releases) oder [boltcli.ai/download](https://boltcli.ai/download) herunter.

| Plattform             | Download                        |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm`, oder `.AppImage` |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Installationsverzeichnis

Das Installationsskript beachtet folgende Prioritätsreihenfolge für den Installationspfad:

1. `$BOLT_INSTALL_DIR` - Benutzerdefiniertes Installationsverzeichnis
2. `$XDG_BIN_DIR` - Pfad gemäß XDG Base Directory Specification
3. `$HOME/bin` - Standard-Binärverzeichnis des Benutzers (falls vorhanden oder erstellbar)
4. `$HOME/.bolt/bin` - Standard-Fallback

```bash
# Beispiele
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Agenten

Bolt CLI enthält integrierte Agenten, zwischen denen Sie mit der `Tab`-Taste wechseln können.

- **code** - Standard-Agent mit vollem Zugriff für Entwicklungsarbeit
- **ask** - Schreibgeschützter Agent für Fragen und Informationssammlung
  - Blockiert standardmäßig Dateibearbeitungen
  - Ideal zum Erkunden unbekannter Codebasen oder zum Stellen von Fragen
- **plan** - Schreibgeschützter Agent für Analyse und Code-Erkundung
  - Verweigert standardmäßig Dateibearbeitungen
  - Bittet um Erlaubnis vor der Ausführung von Bash-Befehlen
  - Ideal zum Planen von Änderungen

Ebenfalls enthalten ist ein **general**-Subagent für komplexe Suchen und mehrstufige Aufgaben.
Dieser wird intern verwendet und kann mit `@general` in Nachrichten aufgerufen werden.

Erfahren Sie mehr über [Agenten](https://boltcli.ai/docs/agents).

### Dokumentation

Für weitere Informationen zur Konfiguration von Bolt CLI [**besuchen Sie unsere Dokumentation**](https://boltcli.ai/docs).

### Mitwirken

Wenn Sie an Bolt CLI mitwirken möchten, lesen Sie bitte unsere [Mitwirkungsdokumentation](./CONTRIBUTING.md), bevor Sie einen Pull-Request einreichen.

### Auf Bolt aufbauen

Wenn Sie an einem Projekt arbeiten, das mit Bolt CLI in Verbindung steht und "bolt" als Teil des Namens verwendet, z. B. "bolt-dashboard" oder "bolt-mobile", fügen Sie bitte einen Hinweis in Ihrer README hinzu, dass es nicht vom Bolt CLI-Team erstellt wurde und in keiner Weise mit uns verbunden ist.

---

**Treten Sie unserer Community bei** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
