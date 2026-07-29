<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">AI-kodingsagenten med åpen kildekode.</p>
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

### Installasjon

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# Pakkehåndtering
npm i -g boltcli-ai@latest        # eller bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS og Linux (anbefales, alltid oppdatert)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # Alle OS
nix run nixpkgs#bolt              # eller github:Bolt-builder/bolt-cli for nyeste dev-gren
```

> [!TIP]
> Fjern versjoner eldre enn 0.1.x før installasjon.

### Skrivebordsapp (BETA)

Bolt CLI er også tilgjengelig som skrivebordsapplikasjon. Last ned direkte fra [utgivelsessiden](https://github.com/Bolt-builder/bolt-cli/releases) eller [boltcli.ai/download](https://boltcli.ai/download).

| Plattform             | Nedlasting                      |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm`, eller `.AppImage` |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Installasjonskatalog

Installasjonsskriptet respekterer følgende prioritetsrekkefølge for installasjonsbanen:

1. `$BOLT_INSTALL_DIR` - Tilpasset installasjonskatalog
2. `$XDG_BIN_DIR` - Bane i samsvar med XDG Base Directory-spesifikasjonen
3. `$HOME/bin` - Standard brukerbinærkatalog (hvis den finnes eller kan opprettes)
4. `$HOME/.bolt/bin` - Standard tilbakefall

```bash
# Eksempler
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Agenter

Bolt CLI inkluderer innebygde agenter du kan bytte mellom med `Tab`-tasten.

- **code** - Standard, full tilgangsagent for utviklingsarbeid
- **ask** - Skrivebeskyttet agent for spørsmål og informasjonsinnhenting
  - Blokkerer filredigeringer som standard
  - Ideell for å utforske ukjente kodebaser eller stille spørsmål
- **plan** - Skrivebeskyttet agent for analyse og kodeutforskning
  - Nekter filredigeringer som standard
  - Ber om tillatelse før kjøring av bash-kommandoer
  - Ideell for å planlegge endringer

Også inkludert er en **general** underagent for komplekse søk og flertrinnsoppgaver.
Denne brukes internt og kan påkalles ved å bruke `@general` i meldinger.

Lær mer om [agenter](https://boltcli.ai/docs/agents).

### Dokumentasjon

For mer informasjon om hvordan du konfigurerer Bolt CLI, [**gå til dokumentasjonen vår**](https://boltcli.ai/docs).

### Bidra

Hvis du er interessert i å bidra til Bolt CLI, vennligst les vår [bidragsdokumentasjon](./CONTRIBUTING.md) før du sender inn en pull request.

### Bygge på Bolt

Hvis du jobber med et prosjekt relatert til Bolt CLI og bruker "bolt" som en del av navnet, for eksempel "bolt-dashboard" eller "bolt-mobile", vennligst legg til en merknad i README for å tydeliggjøre at det ikke er bygget av Bolt CLI-teamet og ikke er tilknyttet oss på noen måte.

---

**Bli med i fellesskapet vårt** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
