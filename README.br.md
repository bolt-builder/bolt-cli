<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">O agente de codificação IA open source.</p>
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

### Instalação

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# Gerenciadores de pacotes
npm i -g boltcli-ai@latest        # ou bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS e Linux (recomendado, sempre atualizado)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # Qualquer OS
nix run nixpkgs#bolt              # ou github:Bolt-builder/bolt-cli para a branch dev mais recente
```

> [!TIP]
> Remova versões anteriores a 0.1.x antes de instalar.

### App Desktop (BETA)

O Bolt CLI também está disponível como aplicativo desktop. Baixe diretamente da [página de releases](https://github.com/Bolt-builder/bolt-cli/releases) ou [boltcli.ai/download](https://boltcli.ai/download).

| Plataforma            | Download                        |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm`, ou `.AppImage`  |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Diretório de Instalação

O script de instalação respeita a seguinte ordem de prioridade para o caminho de instalação:

1. `$BOLT_INSTALL_DIR` - Diretório de instalação personalizado
2. `$XDG_BIN_DIR` - Caminho compatível com a especificação XDG Base Directory
3. `$HOME/bin` - Diretório binário padrão do usuário (se existir ou puder ser criado)
4. `$HOME/.bolt/bin` - Fallback padrão

```bash
# Exemplos
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Agentes

O Bolt CLI inclui agentes integrados que você pode alternar com a tecla `Tab`.

- **code** - Agente padrão com acesso total para trabalho de desenvolvimento
- **ask** - Agente somente leitura para perguntas e coleta de informações
  - Bloqueia edições de arquivo por padrão
  - Ideal para explorar bases de código desconhecidas ou fazer perguntas
- **plan** - Agente somente leitura para análise e exploração de código
  - Nega edições de arquivo por padrão
  - Pede permissão antes de executar comandos bash
  - Ideal para planejar mudanças

Também está incluído um subagente **general** para pesquisas complexas e tarefas de múltiplas etapas.
É usado internamente e pode ser invocado usando `@general` nas mensagens.

Saiba mais sobre [agentes](https://boltcli.ai/docs/agents).

### Documentação

Para mais informações sobre como configurar o Bolt CLI, [**acesse nossa documentação**](https://boltcli.ai/docs).

### Contribuindo

Se você tem interesse em contribuir com o Bolt CLI, leia nossa [documentação de contribuição](./CONTRIBUTING.md) antes de enviar um pull request.

### Construindo sobre o Bolt

Se você está trabalhando em um projeto relacionado ao Bolt CLI e está usando "bolt" como parte do nome, por exemplo "bolt-dashboard" ou "bolt-mobile", adicione uma nota no seu README esclarecendo que não é construído pela equipe do Bolt CLI e não é afiliado a nós de forma alguma.

---

**Junte-se à nossa comunidade** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
