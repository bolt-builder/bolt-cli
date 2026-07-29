<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">Опенсорсный AI-агент для программирования.</p>
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

### Установка

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# Менеджеры пакетов
npm i -g boltcli-ai@latest        # или bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS и Linux (рекомендуется, всегда актуально)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # Любая ОС
nix run nixpkgs#bolt              # или github:Bolt-builder/bolt-cli для последней dev-ветки
```

> [!TIP]
> Перед установкой удалите версии старше 0.1.x.

### Десктопное приложение (BETA)

Bolt CLI также доступен как десктопное приложение. Скачайте напрямую со [страницы релизов](https://github.com/Bolt-builder/bolt-cli/releases) или [boltcli.ai/download](https://boltcli.ai/download).

| Платформа             | Скачать                         |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm` или `.AppImage`  |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Директория установки

Скрипт установки соблюдает следующий порядок приоритетов для пути установки:

1. `$BOLT_INSTALL_DIR` - Пользовательская директория установки
2. `$XDG_BIN_DIR` - Путь, соответствующий спецификации XDG Base Directory
3. `$HOME/bin` - Стандартная бинарная директория пользователя (если существует или может быть создана)
4. `$HOME/.bolt/bin` - Резервный вариант по умолчанию

```bash
# Примеры
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Агенты

Bolt CLI включает встроенных агентов, между которыми можно переключаться клавишей `Tab`.

- **code** - Агент по умолчанию с полным доступом для разработки
- **ask** - Агент только для чтения для вопросов и сбора информации
  - Блокирует редактирование файлов по умолчанию
  - Идеально подходит для изучения незнакомых кодовых баз или вопросов
- **plan** - Агент только для чтения для анализа и исследования кода
  - Отказывает в редактировании файлов по умолчанию
  - Запрашивает разрешение перед выполнением bash-команд
  - Идеально подходит для планирования изменений

Также включён подагент **general** для сложных поисков и многошаговых задач.
Используется внутренне и может быть вызван через `@general` в сообщениях.

Узнайте больше об [агентах](https://boltcli.ai/docs/agents).

### Документация

Для получения дополнительной информации о настройке Bolt CLI [**перейдите к нашей документации**](https://boltcli.ai/docs).

### Участие в разработке

Если вы заинтересованы в участии в разработке Bolt CLI, пожалуйста, прочитайте нашу [документацию для контрибьюторов](./CONTRIBUTING.md) перед отправкой pull request.

### Создание на базе Bolt

Если вы работаете над проектом, связанным с Bolt CLI, и используете "bolt" как часть названия, например "bolt-dashboard" или "bolt-mobile", добавьте примечание в ваш README о том, что он не создан командой Bolt CLI и никак не связан с нами.

---

**Присоединяйтесь к нашему сообществу** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
