<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">El agente de codificación IA de código abierto.</p>
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

### Instalación

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# Gestores de paquetes
npm i -g boltcli-ai@latest        # o bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS y Linux (recomendado, siempre actualizado)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # Cualquier SO
nix run nixpkgs#bolt              # o github:Bolt-builder/bolt-cli para la rama dev más reciente
```

> [!TIP]
> Elimina las versiones anteriores a 0.1.x antes de instalar.

### App de escritorio (BETA)

Bolt CLI también está disponible como aplicación de escritorio. Descárgala directamente desde la [página de releases](https://github.com/Bolt-builder/bolt-cli/releases) o desde [boltcli.ai/download](https://boltcli.ai/download).

| Plataforma            | Descarga                        |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm`, o `.AppImage`   |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Directorio de instalación

El script de instalación respeta el siguiente orden de prioridad para la ruta de instalación:

1. `$BOLT_INSTALL_DIR` - Directorio de instalación personalizado
2. `$XDG_BIN_DIR` - Ruta conforme a la especificación XDG Base Directory
3. `$HOME/bin` - Directorio binario de usuario estándar (si existe o se puede crear)
4. `$HOME/.bolt/bin` - Fallback predeterminado

```bash
# Ejemplos
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Agentes

Bolt CLI incluye agentes integrados que puedes alternar con la tecla `Tab`.

- **code** - Agente predeterminado con acceso completo para trabajo de desarrollo
- **ask** - Agente de solo lectura para preguntas y recopilación de información
  - Bloquea ediciones de archivos por defecto
  - Ideal para explorar bases de código desconocidas o hacer preguntas
- **plan** - Agente de solo lectura para análisis y exploración de código
  - Niega ediciones de archivos por defecto
  - Pide permiso antes de ejecutar comandos bash
  - Ideal para planificar cambios

También se incluye un subagente **general** para búsquedas complejas y tareas de varios pasos.
Se usa internamente y se puede invocar usando `@general` en los mensajes.

Más información sobre [agentes](https://boltcli.ai/docs/agents).

### Documentación

Para más información sobre cómo configurar Bolt CLI, [**consulta nuestra documentación**](https://boltcli.ai/docs).

### Contribuir

Si estás interesado en contribuir a Bolt CLI, lee nuestra [documentación de contribución](./CONTRIBUTING.md) antes de enviar un pull request.

### Construyendo sobre Bolt

Si estás trabajando en un proyecto relacionado con Bolt CLI y estás usando "bolt" como parte de su nombre, por ejemplo "bolt-dashboard" o "bolt-mobile", añade una nota en tu README para aclarar que no está construido por el equipo de Bolt CLI y no está afiliado con nosotros de ninguna manera.

---

**Únete a nuestra comunidad** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
