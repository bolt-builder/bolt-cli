<p align="center">
  <a href="https://boltcli.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Bolt logo">
    </picture>
  </a>
</p>
<p align="center">Ο πράκτορας κωδικοποίησης AI ανοιχτού κώδικα.</p>
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

### Εγκατάσταση

```bash
# YOLO
curl -fsSL https://boltcli.ai/install | bash

# Διαχειριστές πακέτων
npm i -g boltcli-ai@latest        # ή bun/pnpm/yarn
brew install bolt-builder/tap/bolt # macOS και Linux (προτείνεται, πάντα ενημερωμένο)
sudo pacman -S bolt                # Arch Linux
mise use -g bolt                   # Οποιοδήποτε ΛΣ
nix run nixpkgs#bolt              # ή github:Bolt-builder/bolt-cli για το τελευταίο dev branch
```

> [!TIP]
> Αφαιρέστε εκδόσεις παλαιότερες από 0.1.x πριν την εγκατάσταση.

### Εφαρμογή Desktop (BETA)

Το Bolt CLI είναι επίσης διαθέσιμο ως εφαρμογή desktop. Κατεβάστε το απευθείας από τη [σελίδα εκδόσεων](https://github.com/Bolt-builder/bolt-cli/releases) ή το [boltcli.ai/download](https://boltcli.ai/download).

| Πλατφόρμα             | Λήψη                            |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `bolt-desktop-mac-arm64.dmg`    |
| macOS (Intel)         | `bolt-desktop-mac-x64.dmg`      |
| Windows               | `bolt-desktop-windows-x64.exe`  |
| Linux                 | `.deb`, `.rpm`, ή `.AppImage`   |

```bash
# macOS (Homebrew)
brew install --cask bolt-desktop
```

#### Κατάλογος Εγκατάστασης

Το σενάριο εγκατάστασης σέβεται την ακόλουθη σειρά προτεραιότητας για τη διαδρομή εγκατάστασης:

1. `$BOLT_INSTALL_DIR` - Προσαρμοσμένος κατάλογος εγκατάστασης
2. `$XDG_BIN_DIR` - Διαδρομή σύμφωνη με την προδιαγραφή XDG Base Directory
3. `$HOME/bin` - Τυπικός δυαδικός κατάλογος χρήστη (αν υπάρχει ή μπορεί να δημιουργηθεί)
4. `$HOME/.bolt/bin` - Προεπιλεγμένο fallback

```bash
# Παραδείγματα
BOLT_INSTALL_DIR=/usr/local/bin curl -fsSL https://boltcli.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://boltcli.ai/install | bash
```

### Πράκτορες

Το Bolt CLI περιλαμβάνει ενσωματωμένους πράκτορες που μπορείτε να εναλλάσσετε με το πλήκτρο `Tab`.

- **code** - Προεπιλεγμένος πράκτορας πλήρους πρόσβασης για εργασίες ανάπτυξης
- **ask** - Πράκτορας μόνο για ανάγνωση για ερωτήσεις και συλλογή πληροφοριών
  - Αποκλείει τις επεξεργασίες αρχείων από προεπιλογή
  - Ιδανικό για εξερεύνηση άγνωστων βάσεων κώδικα ή υποβολή ερωτήσεων
- **plan** - Πράκτορας μόνο για ανάγνωση για ανάλυση και εξερεύνηση κώδικα
  - Αρνείται τις επεξεργασίες αρχείων από προεπιλογή
  - Ζητά άδεια πριν από την εκτέλεση εντολών bash
  - Ιδανικό για σχεδιασμό αλλαγών

Περιλαμβάνεται επίσης ένας υποπράκτορας **general** για σύνθετες αναζητήσεις και εργασίες πολλαπλών βημάτων.
Χρησιμοποιείται εσωτερικά και μπορεί να κληθεί χρησιμοποιώντας `@general` στα μηνύματα.

Μάθετε περισσότερα για τους [πράκτορες](https://boltcli.ai/docs/agents).

### Τεκμηρίωση

Για περισσότερες πληροφορίες σχετικά με τη διαμόρφωση του Bolt CLI, [**επισκεφθείτε την τεκμηρίωσή μας**](https://boltcli.ai/docs).

### Συνεισφορά

Αν ενδιαφέρεστε να συνεισφέρετε στο Bolt CLI, διαβάστε την [τεκμηρίωση συνεισφοράς](./CONTRIBUTING.md) πριν υποβάλετε ένα pull request.

### Χτίζοντας πάνω στο Bolt

Αν εργάζεστε σε ένα έργο που σχετίζεται με το Bolt CLI και χρησιμοποιείτε το "bolt" ως μέρος του ονόματός του, για παράδειγμα "bolt-dashboard" ή "bolt-mobile", προσθέστε μια σημείωση στο README σας για να διευκρινίσετε ότι δεν έχει δημιουργηθεί από την ομάδα του Bolt CLI και δεν συνδέεται με εμάς με κανέναν τρόπο.

---

**Γίνετε μέλος της κοινότητάς μας** [Discord](https://discord.gg/boltcli) | [X.com](https://x.com/boltcli)
