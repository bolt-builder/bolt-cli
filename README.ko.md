<p align="center">
  <a href="https://github.com/Bolt-builder/bolt-cli">
    <picture>
      <source srcset="images/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt CLI logo">
    </picture>
  </a>
</p>
<p align="center">⚡ 오픈소스 AI 코딩 에이전트 — OpenCode 포크.</p>
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

Bolt CLI는 [OpenCode](https://github.com/anomalyco/opencode)의 포크입니다 — 터미널에서 실행되는 오픈소스 AI 코딩 에이전트입니다. 코드베이스를 읽고, 무엇을 만들고 있는지 이해하며, 더 빠르게 출시할 수 있도록 도와줍니다.

### 설치

```bash
# 빠른 설치
curl -fsSL https://raw.githubusercontent.com/Bolt-builder/bolt-cli/dev/install | bash

# npm에서
npm i -g opencode-ai@latest       # 또는 bun/pnpm/yarn

# 소스에서
git clone https://github.com/Bolt-builder/bolt-cli.git
cd bolt-cli
bun install
bun run build
```

### 데스크톱 앱 (BETA)

[릴리스 페이지](https://github.com/Bolt-builder/bolt-cli/releases)에서 직접 다운로드하세요.

| 플랫폼                | 다운로드                         |
| --------------------- | -------------------------------- |
| macOS (Apple Silicon) | `Bolt-Desktop-mac-arm64.dmg`     |
| macOS (Intel)         | `Bolt-Desktop-mac-x64.dmg`       |
| Windows               | `Bolt-Desktop-windows-x64.exe`   |
| Linux                 | `.deb`, `.rpm`, 또는 `.AppImage` |

### 에이전트

Bolt CLI에는 내장 에이전트가 포함되어 있습니다. `Tab`으로 전환하세요.

| 에이전트 | 접근     | 설명                                                       |
| -------- | -------- | ---------------------------------------------------------- |
| `code`   | 전체     | 개발용 기본 에이전트 — 읽기, 쓰기, 실행                     |
| `ask`    | 읽기     | 질문 및 조사 — 파일 편집 불가                               |
| `plan`   | 읽기     | 분석 및 탐색 — bash 명령 전 확인                            |

또한 포함: 복잡한 다단계 작업을 위한 `general` 서브에이전트. `@general`로 호출하세요.

[에이전트](https://opencode.ai/docs/agents)에 대해 자세히 알아보세요.

### 문서

설정 및 사용법은 [OpenCode 문서](https://opencode.ai/docs)를 확인하세요.

### 기여

기여하고 싶으신가요? PR 제출 전에 [기여 가이드](./CONTRIBUTING.md)를 읽어주세요.

### 크레딧

Bolt CLI는 [anomalyco](https://github.com/anomalyco)의 [OpenCode](https://github.com/anomalyco/opencode) 커뮤니티 포크입니다. 원본 작업의 모든 크레딧은 OpenCode 팀에 있습니다.

---

**커뮤니티** [OpenCode Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
