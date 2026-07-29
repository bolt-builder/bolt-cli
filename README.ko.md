<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">오픈 소스 AI 코딩 에이전트.</p>
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

### 설치

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# 패키지 매니저
npm i -g boltcli-ai@latest        # 또는 bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS 및 Linux (권장, 항상 최신)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # 모든 OS
nix run nixpkgs#bolt              # 또는 github:Bolt-builder/bolt-cli 최신 dev 브랜치
```

> [!TIP]
> 설치 전에 0.1.x보다 오래된 버전을 제거하세요.

### 데스크톱 앱 (BETA)

Bolt CLI는 데스크톱 앱으로도 제공됩니다. [릴리스 페이지](https://github.com/Bolt-builder/bolt-cli/releases)에서 직접 다운로드하거나 [boltcli.ai/download](https://boltcli.ai/download)를 이용하세요.

| 플랫폼                | 다운로드                         |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm`, 또는 `.AppImage` |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### 설치 디렉토리

설치 스크립트는 설치 경로에 대해 다음 우선순위를 따릅니다:

1. `$BOLT_INSTALL_DIR` - 사용자 지정 설치 디렉토리
2. `$XDG_BIN_DIR` - XDG Base Directory 사양 준수 경로
3. `$HOME/bin` - 표준 사용자 바이너리 디렉토리 (존재하거나 생성 가능한 경우)
4. `$HOME/.bolt/bin` - 기본 폴백

```bash
# 예시
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### 에이전트

Bolt CLI에는 `Tab` 키로 전환할 수 있는 내장 에이전트가 포함되어 있습니다.

- **code** - 개발 작업용 기본 전체 액세스 에이전트
- **ask** - 질문 및 정보 수집용 읽기 전용 에이전트
  - 기본적으로 파일 편집 차단
  - 익숙하지 않은 코드베이스 탐색이나 질문에 이상적
- **plan** - 분석 및 코드 탐색용 읽기 전용 에이전트
  - 기본적으로 파일 편집 거부
  - bash 명령 실행 전 허가 요청
  - 변경 계획에 이상적

복잡한 검색 및 다단계 작업을 위한 **general** 하위 에이전트도 포함되어 있습니다.
내부적으로 사용되며 메시지에서 `@general`을 사용하여 호출할 수 있습니다.

[에이전트](https://boltcli.ai/docs/agents)에 대해 자세히 알아보세요.

### 문서

Bolt CLI 구성 방법에 대한 자세한 내용은 [**문서를 참조하세요**](https://boltcli.ai/docs).

### 기여

Bolt CLI에 기여하는 데 관심이 있으시면, 풀 리퀘스트를 제출하기 전에 [기여 문서](./CONTRIBUTING.md)를 읽어주세요.

### Bolt 위에 구축하기

Bolt CLI와 관련된 프로젝트를 작업 중이고 이름의 일부로 "bolt"를 사용하는 경우(예: "bolt-dashboard" 또는 "bolt-mobile"), Bolt CLI 팀이 구축한 것이 아니며 우리와 어떤 방식으로든 제휴되지 않았음을 명확히 하는 메모를 README에 추가하세요.

---

**커뮤니티 참여** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
