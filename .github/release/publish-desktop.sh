#!/usr/bin/env bash
# Generate electron-updater feeds from signed Bolt desktop assets for GitHub release upload.
. "$(dirname "$0")/lib.sh"

macos=$1 windows=$2 linux_x64=$3 linux_arm64=$4
win=("$windows/bolt-desktop-win-arm64.exe" "$windows/bolt-desktop-win-x64.exe")
mac=("$macos/bolt-desktop-mac-arm64.zip" "$macos/bolt-desktop-mac-arm64.dmg" "$macos/bolt-desktop-mac-x64.zip" "$macos/bolt-desktop-mac-x64.dmg")
linux=("$linux_x64/bolt-desktop-linux-x86_64.AppImage" "$linux_x64/bolt-desktop-linux-amd64.deb" "$linux_x64/bolt-desktop-linux-x86_64.rpm")
linux_arm=("$linux_arm64/bolt-desktop-linux-arm64.AppImage" "$linux_arm64/bolt-desktop-linux-arm64.deb" "$linux_arm64/bolt-desktop-linux-aarch64.rpm")
feed() {
  for file in "$@"; do
    jq -n --arg url "https://github.com/bolt-builder/bolt-cli/releases/download/v$OPENCODE_VERSION/$(basename "$file")" \
      --arg sha512 "$(openssl dgst -sha512 -binary "$file" | base64 | tr -d '\n')" --argjson size "$(size "$file")" \
      '{url: $url, sha512: $sha512, size: $size}'
  done | jq -s --arg date "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" '{files: ., releaseDate: $date}'
}

out="$RUNNER_TEMP/desktop-feeds"
mkdir -p "$out"
channel=$OPENCODE_CHANNEL
for group in win mac linux linux-arm64; do
  case "$group" in
    win) selected=("${win[@]}"); suffix="" ;;
    mac) selected=("${mac[@]}"); suffix=-mac ;;
    linux) selected=("${linux[@]}"); suffix=-linux ;;
    linux-arm64) selected=("${linux_arm[@]}"); suffix=-linux-arm64 ;;
  esac
  for file in "${selected[@]}"; do test -s "$file" || die "Missing desktop release file: $file"; done
  feed "${selected[@]}" | jq --arg version "$OPENCODE_VERSION" '. + {version: $version}' > "$out/$channel$suffix.yml"
done
