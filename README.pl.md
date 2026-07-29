<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">Otwartoźródłowy agent kodowania AI.</p>
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

### Instalacja

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# Menedżery pakietów
npm i -g boltcli-ai@latest        # lub bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS i Linux (zalecane, zawsze aktualne)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # Dowolny system
nix run nixpkgs#bolt              # lub github:Bolt-builder/bolt-cli dla najnowszej gałęzi dev
```

> [!TIP]
> Usuń wersje starsze niż 0.1.x przed instalacją.

### Aplikacja desktopowa (BETA)

Bolt CLI jest również dostępny jako aplikacja desktopowa. Pobierz bezpośrednio ze [strony wydań](https://github.com/Bolt-builder/bolt-cli/releases) lub [boltcli.ai/download](https://boltcli.ai/download).

| Platforma             | Pobieranie                      |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm`, lub `.AppImage` |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Katalog instalacyjny

Skrypt instalacyjny uwzględnia następującą kolejność priorytetów dla ścieżki instalacji:

1. `$BOLT_INSTALL_DIR` - Niestandardowy katalog instalacyjny
2. `$XDG_BIN_DIR` - Ścieżka zgodna ze specyfikacją XDG Base Directory
3. `$HOME/bin` - Standardowy katalog binarny użytkownika (jeśli istnieje lub można go utworzyć)
4. `$HOME/.bolt/bin` - Domyślny fallback

```bash
# Przykłady
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Agenci

Bolt CLI zawiera wbudowanych agentów, między którymi można przełączać się klawiszem `Tab`.

- **code** - Domyślny agent z pełnym dostępem do pracy programistycznej
- **ask** - Agent tylko do odczytu do zadawania pytań i zbierania informacji
  - Domyślnie blokuje edycję plików
  - Idealny do eksploracji nieznanych baz kodu lub zadawania pytań
- **plan** - Agent tylko do odczytu do analizy i eksploracji kodu
  - Domyślnie odmawia edycji plików
  - Prosi o pozwolenie przed uruchomieniem poleceń bash
  - Idealny do planowania zmian

Zawiera również podagenta **general** do złożonych wyszukiwań i zadań wieloetapowych.
Jest używany wewnętrznie i można go wywołać za pomocą `@general` w wiadomościach.

Dowiedz się więcej o [agentach](https://boltcli.ai/docs/agents).

### Dokumentacja

Aby uzyskać więcej informacji na temat konfiguracji Bolt CLI, [**zapoznaj się z naszą dokumentacją**](https://boltcli.ai/docs).

### Współtworzenie

Jeśli jesteś zainteresowany współtworzeniem Bolt CLI, przeczytaj naszą [dokumentację dla współtwórców](./CONTRIBUTING.md) przed przesłaniem pull requesta.

### Budowanie na Bolt

Jeśli pracujesz nad projektem związanym z Bolt CLI i używasz "bolt" jako części nazwy, na przykład "bolt-dashboard" lub "bolt-mobile", dodaj notatkę w swoim README wyjaśniającą, że nie jest zbudowany przez zespół Bolt CLI i nie jest z nami w żaden sposób powiązany.

---

**Dołącz do naszej społeczności** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
