<p align="center">
  <a href="https://github.com/Bolt-builder/bolt-cli">
    <picture>
      <source srcset="images/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt CLI logo">
    </picture>
  </a>
</p>
<p align="center">⚡ El agente de código IA open source — fork de OpenCode.</p>
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

Bolt CLI es un fork de [OpenCode](https://github.com/bolt-builder/bolt-cli) — el agente de código con IA open source que se ejecuta en tu terminal. Lee tu código, entiende lo que estás construyendo y te ayuda a lanzar más rápido.

### Instalación

```bash
# Instalación rápida
curl -fsSL https://raw.githubusercontent.com/Bolt-builder/bolt-cli/dev/install | bash

# Desde npm
npm i -g opencode-ai@latest       # o bun/pnpm/yarn

# Desde el código fuente
git clone https://github.com/Bolt-builder/bolt-cli.git
cd bolt-cli
bun install
bun run build
```

### App de escritorio (BETA)

Descarga directamente desde la [página de releases](https://github.com/Bolt-builder/bolt-cli/releases).

| Plataforma            | Descarga                       |
| --------------------- | ------------------------------ |
| macOS (Apple Silicon) | `Bolt-Desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `Bolt-Desktop-mac-x64.dmg`     |
| Windows               | `Bolt-Desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, o `.AppImage`  |

### Agentes

Bolt CLI incluye agentes integrados. Cambia entre ellos con `Tab`.

| Agente | Acceso   | Descripción                                                |
| ------ | -------- | ---------------------------------------------------------- |
| `code` | Completo | Agente por defecto para desarrollo — lee, escribe, ejecuta |
| `ask`  | Lectura  | Preguntas e investigación — sin edición de archivos        |
| `plan` | Lectura  | Análisis y exploración — pregunta antes de comandos bash   |

También incluido: subagente `general` para tareas complejas de varios pasos. Invócalo con `@general`.

Más información sobre [agentes](https://opencode.ai/docs/agents).

### Documentación

Para configuración y uso, consulta la [documentación de OpenCode](https://opencode.ai/docs).

### Contribuir

¿Quieres contribuir? Lee nuestra [guía de contribución](./CONTRIBUTING.md) antes de enviar un PR.

### Créditos

Bolt CLI es un fork comunitario de [OpenCode](https://github.com/bolt-builder/bolt-cli) por [anomalyco](https://github.com/anomalyco). Todo el crédito del trabajo original es para el equipo de OpenCode.

---

**Comunidad** [OpenCode Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
