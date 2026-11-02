#!/usr/bin/env bash
# Validate signed Bolt CLI archives before the GitHub release job publishes them.
. "$(dirname "$0")/lib.sh"

archives=$1 macos=$2 windows=$3
cli=()
for target in linux-arm64 linux-x64 linux-x64-baseline linux-arm64-musl linux-x64-musl linux-x64-baseline-musl; do cli+=("$archives/bolt-cli-$target.tar.gz"); done
for target in darwin-arm64 darwin-x64 darwin-x64-baseline; do cli+=("$macos/bolt-cli-$target.zip"); done
for target in windows-arm64 windows-x64 windows-x64-baseline; do cli+=("$windows/bolt-cli-$target.zip"); done
if [ "$OPENCODE_CHANNEL" != latest ]; then
  for target in linux-arm64 linux-x64; do cli+=("$archives/bolt-cli-node-$target.tar.gz"); done
  for target in darwin-arm64 windows-arm64 windows-x64; do cli+=("$archives/bolt-cli-node-$target.zip"); done
fi
for file in "${cli[@]}"; do
  test -s "$file" || die "Missing release file: $file"
  echo "Validated $(basename "$file")"
done
