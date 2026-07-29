<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">ওপেন সোর্স এআই কোডিং এজেন্ট।</p>
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

### ইনস্টলেশন

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# প্যাকেজ ম্যানেজার
npm i -g boltcli-ai@latest        # অথবা bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS এবং Linux (প্রস্তাবিত, সর্বদা আপ টু ডেট)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # যেকোনো OS
nix run nixpkgs#bolt              # অথবা github:Bolt-builder/bolt-cli সর্বশেষ dev ব্রাঞ্চের জন্য
```

> [!TIP]
> ইনস্টল করার আগে 0.1.x এর চেয়ে পুরানো সংস্করণগুলি সরিয়ে ফেলুন।

### ডেস্কটপ অ্যাপ (BETA)

Bolt CLI ডেস্কটপ অ্যাপ্লিকেশন হিসেবেও উপলব্ধ। সরাসরি [রিলিজ পেজ](https://github.com/Bolt-builder/bolt-cli/releases) অথবা [boltcli.ai/download](https://boltcli.ai/download) থেকে ডাউনলোড করুন।

| প্ল্যাটফর্ম           | ডাউনলোড                         |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm`, অথবা `.AppImage` |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### ইনস্টলেশন ডিরেক্টরি

ইনস্টল স্ক্রিপ্ট ইনস্টলেশন পাথের জন্য নিম্নলিখিত অগ্রাধিকার ক্রম মেনে চলে:

1. `$BOLT_INSTALL_DIR` - কাস্টম ইনস্টলেশন ডিরেক্টরি
2. `$XDG_BIN_DIR` - XDG বেস ডিরেক্টরি স্পেসিফিকেশন অনুযায়ী পাথ
3. `$HOME/bin` - স্ট্যান্ডার্ড ইউজার বাইনারি ডিরেক্টরি (যদি এটি বিদ্যমান থাকে বা তৈরি করা যায়)
4. `$HOME/.bolt/bin` - ডিফল্ট ফলব্যাক

```bash
# উদাহরণ
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### এজেন্ট

Bolt CLI তে বিল্ট-ইন এজেন্ট রয়েছে যা আপনি `Tab` কী দিয়ে পরিবর্তন করতে পারেন।

- **code** - ডেভেলপমেন্ট কাজের জন্য ডিফল্ট, পূর্ণ-অ্যাক্সেস এজেন্ট
- **ask** - প্রশ্ন এবং তথ্য সংগ্রহের জন্য শুধুমাত্র-পঠন এজেন্ট
  - ডিফল্টভাবে ফাইল সম্পাদনা ব্লক করে
  - অপরিচিত কোডবেস অন্বেষণ বা প্রশ্ন জিজ্ঞাসার জন্য আদর্শ
- **plan** - বিশ্লেষণ এবং কোড অন্বেষণের জন্য শুধুমাত্র-পঠন এজেন্ট
  - ডিফল্টভাবে ফাইল সম্পাদনা অস্বীকার করে
  - bash কমান্ড চালানোর আগে অনুমতি চায়
  - পরিবর্তনের পরিকল্পনার জন্য আদর্শ

এছাড়াও জটিল অনুসন্ধান এবং মাল্টিস্টেপ কাজের জন্য একটি **general** সাবএজেন্ট অন্তর্ভুক্ত রয়েছে।
এটি অভ্যন্তরীণভাবে ব্যবহৃত হয় এবং মেসেজে `@general` ব্যবহার করে আহ্বান করা যায়।

[এজেন্ট](https://boltcli.ai/docs/agents) সম্পর্কে আরও জানুন।

### ডকুমেন্টেশন

Bolt CLI কনফিগার করার আরও তথ্যের জন্য, [**আমাদের ডক্স দেখুন**](https://boltcli.ai/docs)।

### অবদান

আপনি যদি Bolt CLI তে অবদান রাখতে আগ্রহী হন, দয়া করে পুল রিকোয়েস্ট জমা দেওয়ার আগে আমাদের [অবদান ডক্স](./CONTRIBUTING.md) পড়ুন।

### Bolt এর উপর নির্মাণ

আপনি যদি Bolt CLI সম্পর্কিত কোনো প্রজেক্টে কাজ করেন এবং নামের অংশ হিসেবে "bolt" ব্যবহার করেন, উদাহরণস্বরূপ "bolt-dashboard" বা "bolt-mobile", দয়া করে আপনার README তে একটি নোট যোগ করুন যে এটি Bolt CLI টিম দ্বারা নির্মিত নয় এবং আমাদের সাথে কোনোভাবেই সম্পর্কিত নয়।

---

**আমাদের কমিউনিটিতে যোগ দিন** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
