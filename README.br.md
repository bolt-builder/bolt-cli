<p align="center">
  <a href="https://github.com/Bolt-builder/bolt-cli">
    <picture>
      <source srcset="images/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt CLI logo">
    </picture>
  </a>
</p>
<p align="center">⚡ O agente de código IA open source — fork do OpenCode.</p>
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

Bolt CLI é um fork do [OpenCode](https://github.com/bolt-builder/bolt-cli) — o agente de código IA open source que roda no seu terminal. Ele lê seu código, entende o que você está construindo e te ajuda a lançar mais rápido.

### Instalação

```bash
# Instalação rápida
curl -fsSL https://raw.githubusercontent.com/Bolt-builder/bolt-cli/dev/install | bash

# Do npm
npm i -g opencode-ai@latest       # ou bun/pnpm/yarn

# Do código fonte
git clone https://github.com/Bolt-builder/bolt-cli.git
cd bolt-cli
bun install
bun run build
```

### App Desktop (BETA)

Baixe diretamente da [página de releases](https://github.com/Bolt-builder/bolt-cli/releases).

| Plataforma            | Download                       |
| --------------------- | ------------------------------ |
| macOS (Apple Silicon) | `Bolt-Desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `Bolt-Desktop-mac-x64.dmg`     |
| Windows               | `Bolt-Desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, ou `.AppImage` |

### Agentes

Bolt CLI inclui agentes integrados. Alterne entre eles com `Tab`.

| Agente | Acesso   | Descrição                                                 |
| ------ | -------- | --------------------------------------------------------- |
| `code` | Completo | Agente padrão para desenvolvimento — lê, escreve, executa |
| `ask`  | Leitura  | Perguntas e pesquisa — sem edição de arquivos             |
| `plan` | Leitura  | Análise e exploração — pergunta antes de comandos bash    |

Também incluso: subagente `general` para tarefas complexas em várias etapas. Invoque com `@general`.

Saiba mais sobre [agentes](https://opencode.ai/docs/agents).

### Documentação

Para configuração e uso, confira a [documentação do OpenCode](https://opencode.ai/docs).

### Contribuindo

Quer contribuir? Leia nosso [guia de contribuição](./CONTRIBUTING.md) antes de enviar um PR.

### Créditos

Bolt CLI é um fork comunitário do [OpenCode](https://github.com/bolt-builder/bolt-cli) por [anomalyco](https://github.com/anomalyco). Todo o crédito pelo trabalho original é da equipe OpenCode.

---

**Comunidade** [OpenCode Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
