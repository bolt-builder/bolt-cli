<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">เอเจนต์โค้ด AI แบบโอเพนซอร์ส</p>
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

### การติดตั้ง

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# ตัวจัดการแพ็คเกจ
npm i -g boltcli-ai@latest        # หรือ bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS และ Linux (แนะนำ, อัปเดตล่าสุดเสมอ)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # ทุกระบบปฏิบัติการ
nix run nixpkgs#bolt              # หรือ github:Bolt-builder/bolt-cli สำหรับสาขา dev ล่าสุด
```

> [!TIP]
> ลบเวอร์ชันที่เก่ากว่า 0.1.x ก่อนติดตั้ง

### แอปเดสก์ท็อป (BETA)

Bolt CLI ยังมีให้ใช้เป็นแอปพลิเคชันเดสก์ท็อป ดาวน์โหลดโดยตรงจาก [หน้าออกเวอร์ชัน](https://github.com/Bolt-builder/bolt-cli/releases) หรือ [boltcli.ai/download](https://boltcli.ai/download)

| แพลตฟอร์ม            | ดาวน์โหลด                       |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm`, หรือ `.AppImage` |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### ไดเรกทอรีการติดตั้ง

สคริปต์ติดตั้งเคารพลำดับความสำคัญต่อไปนี้สำหรับเส้นทางการติดตั้ง:

1. `$BOLT_INSTALL_DIR` - ไดเรกทอรีการติดตั้งที่กำหนดเอง
2. `$XDG_BIN_DIR` - เส้นทางตามข้อกำหนด XDG Base Directory
3. `$HOME/bin` - ไดเรกทอรีไบนารีผู้ใช้มาตรฐาน (หากมีอยู่หรือสามารถสร้างได้)
4. `$HOME/.bolt/bin` - ค่าเริ่มต้นสำรอง

```bash
# ตัวอย่าง
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### เอเจนต์

Bolt CLI มีเอเจนต์ในตัวที่คุณสามารถสลับได้ด้วยปุ่ม `Tab`

- **code** - เอเจนต์เริ่มต้นที่เข้าถึงได้เต็มรูปแบบสำหรับงานพัฒนา
- **ask** - เอเจนต์แบบอ่านอย่างเดียวสำหรับการถามคำถามและรวบรวมข้อมูล
  - บล็อกการแก้ไขไฟล์ตามค่าเริ่มต้น
  - เหมาะสำหรับการสำรวจฐานโค้ดที่ไม่คุ้นเคยหรือถามคำถาม
- **plan** - เอเจนต์แบบอ่านอย่างเดียวสำหรับการวิเคราะห์และสำรวจโค้ด
  - ปฏิเสธการแก้ไขไฟล์ตามค่าเริ่มต้น
  - ขออนุญาตก่อนรันคำสั่ง bash
  - เหมาะสำหรับการวางแผนการเปลี่ยนแปลง

ยังมีซับเอเจนต์ **general** สำหรับการค้นหาที่ซับซ้อนและงานหลายขั้นตอน
ใช้ภายในและสามารถเรียกใช้โดยใช้ `@general` ในข้อความ

เรียนรู้เพิ่มเติมเกี่ยวกับ [เอเจนต์](https://boltcli.ai/docs/agents)

### เอกสารประกอบ

สำหรับข้อมูลเพิ่มเติมเกี่ยวกับการกำหนดค่า Bolt CLI [**ไปที่เอกสารของเรา**](https://boltcli.ai/docs)

### การมีส่วนร่วม

หากคุณสนใจที่จะมีส่วนร่วมกับ Bolt CLI โปรดอ่าน [เอกสารการมีส่วนร่วม](./CONTRIBUTING.md) ก่อนส่ง pull request

### การสร้างบน Bolt

หากคุณกำลังทำงานในโปรเจกต์ที่เกี่ยวข้องกับ Bolt CLI และใช้ "bolt" เป็นส่วนหนึ่งของชื่อ เช่น "bolt-dashboard" หรือ "bolt-mobile" โปรดเพิ่มหมายเหตุใน README ของคุณเพื่อชี้แจงว่าไม่ได้สร้างโดยทีม Bolt CLI และไม่เกี่ยวข้องกับเราแต่อย่างใด

---

**เข้าร่วมชุมชนของเรา** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
