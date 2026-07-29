<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">Open source AI-kodningsagenten.</p>
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

# Pakkehåndtering
npm i -g boltcli-ai@latest        # eller bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS og Linux (anbefales, altid opdateret)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # Ethvert OS
nix run nixpkgs#bolt              # eller github:Bolt-builder/bolt-cli for seneste dev-branch
```

> [!TIP]
> Fjern versioner ældre end 0.1.x før installation.

### Desktop-app (BETA)

Bolt CLI findes også som desktop-app. Download direkte fra [releases-siden](https://github.com/Bolt-builder/bolt-cli/releases) eller [boltcli.ai/download](https://boltcli.ai/download).

| Platform              | Download                          |
| --------------------- | --------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`      |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`        |
| Windows               | `bolt-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, eller `.AppImage` |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Installationsmappe

Installationsscriptet respekterer følgende prioriteringsrækkefølge for installationsstien:

1. `$BOLT_INSTALL_DIR` - Brugerdefineret installationsmappe
2. `$XDG_BIN_DIR` - Sti i overensstemmelse med XDG Base Directory-specifikationen
3. `$HOME/bin` - Standard brugerbinær-mappe (hvis den findes eller kan oprettes)
4. `$HOME/.bolt/bin` - Standard fallback

```bash
# Eksempler
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Agenter

Bolt CLI inkluderer indbyggede agenter, du kan skifte mellem med `Tab`-tasten.

- **code** - Standard, fuld adgang agent til udviklingsarbejde
- **ask** - Skrivebeskyttet agent til spørgsmål og informationsindsamling
  - Blokerer filredigeringer som standard
  - Ideel til at udforske ukendte kodebaser eller stille spørgsmål
- **plan** - Skrivebeskyttet agent til analyse og kodeudforskning
  - Afviser filredigeringer som standard
  - Beder om tilladelse før kørsel af bash-kommandoer
  - Ideel til at planlægge ændringer

Også inkluderet er en **general** underagent til komplekse søgninger og flertrinsopgaver.
Denne bruges internt og kan aktiveres ved at bruge `@general` i beskeder.

Læs mere om [agenter](https://boltcli.ai/docs/agents).

### Dokumentation

For mere info om, hvordan du konfigurerer Bolt CLI, [**gå til vores dokumentation**](https://boltcli.ai/docs).

### Bidrag

Hvis du er interesseret i at bidrage til Bolt CLI, så læs venligst vores [bidragsdokumentation](./CONTRIBUTING.md), før du indsender en pull request.

### Byg på Bolt

Hvis du arbejder på et projekt relateret til Bolt CLI og bruger "bolt" som en del af navnet, f.eks. "bolt-dashboard" eller "bolt-mobile", så tilføj en note i din README for at præcisere, at det ikke er bygget af Bolt CLI-teamet og ikke er tilknyttet os på nogen måde.

---

**Bliv en del af vores fællesskab** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
