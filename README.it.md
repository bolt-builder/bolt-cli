<p align="center">
  <a href="https://github.com/Bolt-builder/bolt-cli">
    <picture>
      <source srcset="images/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt CLI logo">
    </picture>
  </a>
</p>
<p align="center">⚡ L'agente di codifica IA open source — fork di OpenCode.</p>
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

Bolt CLI è un fork di [OpenCode](https://github.com/bolt-builder/bolt-cli) — l'agente di codifica IA open source che gira nel tuo terminale. Legge il tuo codice, capisce cosa stai costruendo e ti aiuta a rilasciare più velocemente.

### Installazione

```bash
# Installazione rapida
curl -fsSL https://raw.githubusercontent.com/Bolt-builder/bolt-cli/dev/install | bash

# Da npm
npm i -g opencode-ai@latest       # oppure bun/pnpm/yarn

# Dai sorgenti
git clone https://github.com/Bolt-builder/bolt-cli.git
cd bolt-cli
bun install
bun run build
```

### App Desktop (BETA)

Scarica direttamente dalla [pagina release](https://github.com/Bolt-builder/bolt-cli/releases).

| Piattaforma           | Download                         |
| --------------------- | -------------------------------- |
| macOS (Apple Silicon) | `Bolt-Desktop-mac-arm64.dmg`     |
| macOS (Intel)         | `Bolt-Desktop-mac-x64.dmg`       |
| Windows               | `Bolt-Desktop-windows-x64.exe`   |
| Linux                 | `.deb`, `.rpm`, o `.AppImage`    |

### Agenti

Bolt CLI include agenti integrati. Passa da uno all'altro con `Tab`.

| Agente  | Accesso      | Descrizione                                                      |
| ------- | ------------ | ---------------------------------------------------------------- |
| `code`  | Completo     | Agente predefinito per lo sviluppo — legge, scrive, esegue       |
| `ask`   | Lettura      | Domande e ricerca — nessuna modifica ai file                     |
| `plan`  | Lettura      | Analisi ed esplorazione — chiede prima dei comandi bash          |

Incluso anche: subagente `general` per task complessi multi-passo. Invocalo con `@general`.

Scopri di più sugli [agenti](https://opencode.ai/docs/agents).

### Documentazione

Per configurazione e utilizzo, consulta la [documentazione di OpenCode](https://opencode.ai/docs).

### Contribuire

Vuoi contribuire? Leggi la nostra [guida per i contributor](./CONTRIBUTING.md) prima di inviare una PR.

### Crediti

Bolt CLI è un fork comunitario di [OpenCode](https://github.com/bolt-builder/bolt-cli) di [anomalyco](https://github.com/anomalyco). Tutto il merito per il lavoro originale va al team OpenCode.

---

**Community** [OpenCode Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
