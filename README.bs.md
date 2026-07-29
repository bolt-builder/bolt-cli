<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">AI coding agent otvorenog koda.</p>
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

### Instalacija

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# Menadžeri paketa
npm i -g boltcli-ai@latest        # ili bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS i Linux (preporučeno, uvijek ažurno)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # Bilo koji OS
nix run nixpkgs#bolt              # ili github:Bolt-builder/bolt-cli za najnoviju dev granu
```

> [!TIP]
> Uklonite verzije starije od 0.1.x prije instalacije.

### Desktop aplikacija (BETA)

Bolt CLI je dostupan i kao desktop aplikacija. Preuzmite direktno sa [stranice izdanja](https://github.com/Bolt-builder/bolt-cli/releases) ili [boltcli.ai/download](https://boltcli.ai/download).

| Platforma             | Preuzimanje                     |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm`, ili `.AppImage` |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Instalacijski direktorij

Instalacijska skripta poštuje sljedeći prioritet za instalacijsku putanju:

1. `$BOLT_INSTALL_DIR` - Prilagođeni instalacijski direktorij
2. `$XDG_BIN_DIR` - Putanja usklađena sa XDG Base Directory specifikacijom
3. `$HOME/bin` - Standardni korisnički binarni direktorij (ako postoji ili se može kreirati)
4. `$HOME/.bolt/bin` - Zadani fallback

```bash
# Primjeri
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Agenti

Bolt CLI uključuje ugrađene agente koje možete mijenjati tipkom `Tab`.

- **code** - Zadani agent s punim pristupom za razvojni rad
- **ask** - Agent samo za čitanje za pitanja i prikupljanje informacija
  - Blokira izmjene datoteka prema zadanim postavkama
  - Idealan za istraživanje nepoznatih baza koda ili postavljanje pitanja
- **plan** - Agent samo za čitanje za analizu i istraživanje koda
  - Odbija izmjene datoteka prema zadanim postavkama
  - Traži dozvolu prije pokretanja bash komandi
  - Idealan za planiranje promjena

Također je uključen **general** podagent za složena pretraživanja i zadatke u više koraka.
Koristi se interno i može se pozvati pomoću `@general` u porukama.

Saznajte više o [agentima](https://boltcli.ai/docs/agents).

### Dokumentacija

Za više informacija o konfiguraciji Bolt CLI-ja, [**pogledajte našu dokumentaciju**](https://boltcli.ai/docs).

### Doprinos

Ako ste zainteresirani za doprinos Bolt CLI-ju, pročitajte našu [dokumentaciju za doprinos](./CONTRIBUTING.md) prije slanja pull requesta.

### Izgradnja na Boltu

Ako radite na projektu povezanom s Bolt CLI-jem i koristite "bolt" kao dio naziva, na primjer "bolt-dashboard" ili "bolt-mobile", dodajte napomenu u svoj README da pojasnite da nije izgrađen od strane Bolt CLI tima i nije povezan s nama ni na koji način.

---

**Pridružite se našoj zajednici** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
