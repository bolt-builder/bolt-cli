<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">Tác nhân lập trình AI mã nguồn mở.</p>
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

### Cài đặt

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# Trình quản lý gói
npm i -g boltcli-ai@latest        # hoặc bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS và Linux (khuyên dùng, luôn cập nhật)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # Mọi hệ điều hành
nix run nixpkgs#bolt              # hoặc github:Bolt-builder/bolt-cli cho nhánh dev mới nhất
```

> [!TIP]
> Gỡ bỏ các phiên bản cũ hơn 0.1.x trước khi cài đặt.

### Ứng dụng Desktop (BETA)

Bolt CLI cũng có sẵn dưới dạng ứng dụng desktop. Tải trực tiếp từ [trang phát hành](https://github.com/Bolt-builder/bolt-cli/releases) hoặc [boltcli.ai/download](https://boltcli.ai/download).

| Nền tảng              | Tải xuống                        |
| --------------------- | -------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`     |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`       |
| Windows               | `bolt-desktop-windows-x64.exe`   |
| Linux                 | `.deb`, `.rpm`, hoặc `.AppImage` |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Thư mục cài đặt

Script cài đặt tuân theo thứ tự ưu tiên sau cho đường dẫn cài đặt:

1. `$BOLT_INSTALL_DIR` - Thư mục cài đặt tùy chỉnh
2. `$XDG_BIN_DIR` - Đường dẫn tuân thủ đặc tả XDG Base Directory
3. `$HOME/bin` - Thư mục nhị phân người dùng tiêu chuẩn (nếu tồn tại hoặc có thể tạo)
4. `$HOME/.bolt/bin` - Dự phòng mặc định

```bash
# Ví dụ
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Tác nhân (Agent)

Bolt CLI bao gồm các tác nhân tích hợp mà bạn có thể chuyển đổi bằng phím `Tab`.

- **code** - Tác nhân mặc định, toàn quyền truy cập cho công việc phát triển
- **ask** - Tác nhân chỉ đọc để đặt câu hỏi và thu thập thông tin
  - Chặn chỉnh sửa tệp theo mặc định
  - Lý tưởng để khám phá các cơ sở mã không quen thuộc hoặc đặt câu hỏi
- **plan** - Tác nhân chỉ đọc để phân tích và khám phá mã
  - Từ chối chỉnh sửa tệp theo mặc định
  - Yêu cầu quyền trước khi chạy lệnh bash
  - Lý tưởng để lập kế hoạch thay đổi

Cũng bao gồm một tác nhân phụ **general** cho các tìm kiếm phức tạp và tác vụ nhiều bước.
Được sử dụng nội bộ và có thể được gọi bằng `@general` trong tin nhắn.

Tìm hiểu thêm về [tác nhân](https://boltcli.ai/docs/agents).

### Tài liệu

Để biết thêm thông tin về cách cấu hình Bolt CLI, [**hãy xem tài liệu của chúng tôi**](https://boltcli.ai/docs).

### Đóng góp

Nếu bạn quan tâm đến việc đóng góp cho Bolt CLI, vui lòng đọc [tài liệu đóng góp](./CONTRIBUTING.md) trước khi gửi pull request.

### Xây dựng trên Bolt

Nếu bạn đang làm việc trên một dự án liên quan đến Bolt CLI và đang sử dụng "bolt" như một phần của tên, ví dụ "bolt-dashboard" hoặc "bolt-mobile", vui lòng thêm ghi chú vào README của bạn để làm rõ rằng nó không được xây dựng bởi nhóm Bolt CLI và không liên kết với chúng tôi dưới bất kỳ hình thức nào.

---

**Tham gia cộng đồng của chúng tôi** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
