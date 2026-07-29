<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">عميل البرمجة مفتوح المصدر بالذكاء الاصطناعي.</p>
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

### التثبيت

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# مدراء الحزم
npm i -g boltcli-ai@latest        # أو bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS و Linux (موصى به، محدث دائمًا)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # أي نظام تشغيل
nix run nixpkgs#bolt              # أو github:Bolt-builder/bolt-cli لأحدث فرع dev
```

> [!TIP]
> قم بإزالة الإصدارات الأقدم من 0.1.x قبل التثبيت.

### تطبيق سطح المكتب (BETA)

Bolt CLI متاح أيضًا كتطبيق سطح مكتب. قم بالتنزيل مباشرة من [صفحة الإصدارات](https://github.com/Bolt-builder/bolt-cli/releases) أو [boltcli.ai/download](https://boltcli.ai/download).

| المنصة                | التحميل                         |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`، `.rpm`، أو `.AppImage`  |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### دليل التثبيت

يحترم سكريبت التثبيت ترتيب الأولوية التالي لمسار التثبيت:

1. `$BOLT_INSTALL_DIR` - دليل تثبيت مخصص
2. `$XDG_BIN_DIR` - مسار متوافق مع مواصفات XDG Base Directory
3. `$HOME/bin` - دليل ثنائي المستخدم القياسي (إذا كان موجودًا أو يمكن إنشاؤه)
4. `$HOME/.bolt/bin` - الاحتياطي الافتراضي

```bash
# أمثلة
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### الوكلاء

يتضمن Bolt CLI وكلاء مدمجين يمكنك التبديل بينهم باستخدام مفتاح `Tab`.

- **code** - الوكيل الافتراضي ذو الوصول الكامل لأعمال التطوير
- **ask** - وكيل للقراءة فقط للأسئلة وجمع المعلومات
  - يمنع تعديل الملفات افتراضيًا
  - مثالي لاستكشاف قواعد التعليمات البرمجية غير المألوفة أو طرح الأسئلة
- **plan** - وكيل للقراءة فقط للتحليل واستكشاف الكود
  - يرفض تعديل الملفات افتراضيًا
  - يطلب الإذن قبل تشغيل أوامر bash
  - مثالي للتخطيط للتغييرات

يتضمن أيضًا وكيل فرعي **general** للبحث المعقد والمهام متعددة الخطوات.
يُستخدم داخليًا ويمكن استدعاؤه باستخدام `@general` في الرسائل.

تعرف على المزيد حول [الوكلاء](https://boltcli.ai/docs/agents).

### التوثيق

لمزيد من المعلومات حول كيفية تكوين Bolt CLI، [**توجه إلى وثائقنا**](https://boltcli.ai/docs).

### المساهمة

إذا كنت مهتمًا بالمساهمة في Bolt CLI، يرجى قراءة [وثائق المساهمة](./CONTRIBUTING.md) قبل تقديم طلب سحب.

### البناء على Bolt

إذا كنت تعمل على مشروع مرتبط بـ Bolt CLI ويستخدم "bolt" كجزء من اسمه، على سبيل المثال "bolt-dashboard" أو "bolt-mobile"، يرجى إضافة ملاحظة في README الخاص بك لتوضيح أنه ليس مبنيًا من قبل فريق Bolt CLI وليس تابعًا لنا بأي شكل من الأشكال.

---

**انضم إلى مجتمعنا** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
