<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">Опенсорсний AI-агент для програмування.</p>
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

### Встановлення

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# Менеджери пакетів
npm i -g boltcli-ai@latest        # або bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS і Linux (рекомендується, завжди актуально)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # Будь-яка ОС
nix run nixpkgs#bolt              # або github:Bolt-builder/bolt-cli для останньої dev-гілки
```

> [!TIP]
> Видаліть версії старіші за 0.1.x перед встановленням.

### Десктопний застосунок (BETA)

Bolt CLI також доступний як десктопний застосунок. Завантажте прямо зі [сторінки релізів](https://github.com/Bolt-builder/bolt-cli/releases) або [boltcli.ai/download](https://boltcli.ai/download).

| Платформа             | Завантаження                    |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm` або `.AppImage`  |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Директорія встановлення

Скрипт встановлення дотримується наступного порядку пріоритетів для шляху встановлення:

1. `$BOLT_INSTALL_DIR` - Користувацька директорія встановлення
2. `$XDG_BIN_DIR` - Шлях, що відповідає специфікації XDG Base Directory
3. `$HOME/bin` - Стандартна бінарна директорія користувача (якщо існує або може бути створена)
4. `$HOME/.bolt/bin` - Резервний варіант за замовчуванням

```bash
# Приклади
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Агенти

Bolt CLI включає вбудованих агентів, між якими можна перемикатися клавішею `Tab`.

- **code** - Агент за замовчуванням з повним доступом для розробки
- **ask** - Агент тільки для читання для запитань і збору інформації
  - Блокує редагування файлів за замовчуванням
  - Ідеально підходить для дослідження незнайомих кодових баз або запитань
- **plan** - Агент тільки для читання для аналізу та дослідження коду
  - Відмовляє в редагуванні файлів за замовчуванням
  - Запитує дозвіл перед виконанням bash-команд
  - Ідеально підходить для планування змін

Також включено підагента **general** для складних пошуків і багатокрокових завдань.
Використовується внутрішньо і може бути викликаний через `@general` у повідомленнях.

Дізнайтеся більше про [агентів](https://boltcli.ai/docs/agents).

### Документація

Для отримання додаткової інформації про налаштування Bolt CLI [**перейдіть до нашої документації**](https://boltcli.ai/docs).

### Участь у розробці

Якщо ви зацікавлені в участі у розробці Bolt CLI, будь ласка, прочитайте нашу [документацію для контриб'юторів](./CONTRIBUTING.md) перед відправленням pull request.

### Створення на базі Bolt

Якщо ви працюєте над проєктом, пов'язаним з Bolt CLI, і використовуєте "bolt" як частину назви, наприклад "bolt-dashboard" або "bolt-mobile", додайте примітку у ваш README про те, що він не створений командою Bolt CLI і жодним чином не пов'язаний з нами.

---

**Приєднуйтесь до нашої спільноти** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
