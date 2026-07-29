<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">Açık kaynak AI kodlama ajanı.</p>
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

### Kurulum

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# Paket yöneticileri
npm i -g boltcli-ai@latest        # veya bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS ve Linux (önerilir, her zaman güncel)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # Herhangi bir işletim sistemi
nix run nixpkgs#bolt              # veya github:Bolt-builder/bolt-cli en son dev dalı için
```

> [!TIP]
> Kurulumdan önce 0.1.x'ten eski sürümleri kaldırın.

### Masaüstü Uygulaması (BETA)

Bolt CLI ayrıca masaüstü uygulaması olarak da mevcuttur. Doğrudan [sürümler sayfasından](https://github.com/Bolt-builder/bolt-cli/releases) veya [boltcli.ai/download](https://boltcli.ai/download) adresinden indirin.

| Platform              | İndirme                          |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm`, veya `.AppImage` |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Kurulum Dizini

Kurulum betiği, kurulum yolu için aşağıdaki öncelik sırasına uyar:

1. `$BOLT_INSTALL_DIR` - Özel kurulum dizini
2. `$XDG_BIN_DIR` - XDG Base Directory şartnamesine uygun yol
3. `$HOME/bin` - Standart kullanıcı binary dizini (varsa veya oluşturulabiliyorsa)
4. `$HOME/.bolt/bin` - Varsayılan yedek

```bash
# Örnekler
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Ajanlar

Bolt CLI, `Tab` tuşuyla aralarında geçiş yapabileceğiniz yerleşik ajanlar içerir.

- **code** - Geliştirme çalışmaları için varsayılan, tam erişimli ajan
- **ask** - Sorular ve bilgi toplama için salt okunur ajan
  - Varsayılan olarak dosya düzenlemelerini engeller
  - Bilinmeyen kod tabanlarını keşfetmek veya soru sormak için idealdir
- **plan** - Analiz ve kod keşfi için salt okunur ajan
  - Varsayılan olarak dosya düzenlemelerini reddeder
  - Bash komutlarını çalıştırmadan önce izin ister
  - Değişiklikleri planlamak için idealdir

Ayrıca karmaşık aramalar ve çok adımlı görevler için bir **general** alt ajanı da bulunur.
Bu dahili olarak kullanılır ve mesajlarda `@general` kullanılarak çağrılabilir.

[Ajanlar](https://boltcli.ai/docs/agents) hakkında daha fazla bilgi edinin.

### Dokümantasyon

Bolt CLI'yi yapılandırma hakkında daha fazla bilgi için [**dokümanlarımıza göz atın**](https://boltcli.ai/docs).

### Katkıda Bulunma

Bolt CLI'ye katkıda bulunmak istiyorsanız, lütfen bir pull request göndermeden önce [katkı dokümanlarımızı](./CONTRIBUTING.md) okuyun.

### Bolt Üzerine İnşa Etme

Bolt CLI ile ilgili bir proje üzerinde çalışıyorsanız ve adının bir parçası olarak "bolt" kullanıyorsanız, örneğin "bolt-dashboard" veya "bolt-mobile", lütfen README'nize Bolt CLI ekibi tarafından oluşturulmadığını ve bizimle hiçbir şekilde bağlantılı olmadığını açıklayan bir not ekleyin.

---

**Topluluğumuza katılın** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
