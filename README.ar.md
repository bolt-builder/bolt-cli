<p align="center">
  <a href="https://github.com/Bolt-builder/bolt-cli">
    <picture>
      <source srcset="images/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt CLI logo">
    </picture>
  </a>
</p>
<p align="center">⚡ وكيل البرمجة بالذكاء الاصطناعي مفتوح المصدر — متفرع من OpenCode.</p>
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

Bolt CLI هو تفرع من [OpenCode](https://github.com/bolt-builder/bolt-cli) — وكيل البرمجة بالذكاء الاصطناعي مفتوح المصدر الذي يعمل في الطرفية. يقرأ قاعدة التعليمات البرمجية الخاصة بك، ويفهم ما تقوم ببنائه، ويساعدك على الإطلاق بشكل أسرع.

### التثبيت

```bash
# تثبيت سريع
curl -fsSL https://raw.githubusercontent.com/Bolt-builder/bolt-cli/dev/install | bash

# من npm
npm i -g opencode-ai@latest       # أو bun/pnpm/yarn

# من المصدر
git clone https://github.com/Bolt-builder/bolt-cli.git
cd bolt-cli
bun install
bun run build
```

### تطبيق سطح المكتب (BETA)

قم بالتنزيل مباشرة من [صفحة الإصدارات](https://github.com/Bolt-builder/bolt-cli/releases).

| المنصة                | التحميل                         |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `Bolt-Desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `Bolt-Desktop-mac-x64.dmg`      |
| Windows               | `Bolt-Desktop-windows-x64.exe`  |
| Linux                 | `.deb` أو `.rpm` أو `.AppImage` |

### الوكلاء

يتضمن Bolt CLI وكلاء مدمجين. تنقل بينهم باستخدام `Tab`.

| الوكيل | الوصول | الوصف                                       |
| ------ | ------ | ------------------------------------------- |
| `code` | كامل   | الوكيل الافتراضي للتطوير — يقرأ ويكتب وينفذ |
| `ask`  | قراءة  | الأسئلة والبحث — لا يسمح بتعديل الملفات     |
| `plan` | قراءة  | التحليل والاستكشاف — يسأل قبل أوامر bash    |

متضمن أيضًا: الوكيل الفرعي `general` للمهام المعقدة متعددة الخطوات. استدعِه باستخدام `@general`.

تعرف على المزيد حول [الوكلاء](https://opencode.ai/docs/agents).

### التوثيق

للتكوين والاستخدام، راجع [توثيق OpenCode](https://opencode.ai/docs).

### المساهمة

مهتم بالمساهمة؟ اقرأ [دليل المساهمة](./CONTRIBUTING.md) قبل تقديم PR.

### الشكر

Bolt CLI هو تفرع مجتمعي من [OpenCode](https://github.com/bolt-builder/bolt-cli) بواسطة [anomalyco](https://github.com/anomalyco). كل الشكر للعمل الأصلي يذهب لفريق OpenCode.

---

**المجتمع** [OpenCode Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
