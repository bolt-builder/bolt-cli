#!/usr/bin/env bash
# repack-windows.sh <work dir> <out dir>: checks every signature in <work dir>, then writes the signed CLI back
# into npm tarballs and bolt-cli-<target>.zip archives in <out dir>.
. "$(dirname "$0")/lib.sh"

work=$(posix "$1") out=$(posix "$2")
bash "$release_dir/verify-signatures-windows.sh" "$work"
mkdir -p "$out"
if [ ! -d "$work/cli" ]; then exit 0; fi
for target in windows-arm64 windows-x64 windows-x64-baseline; do
  tar -czf "$out/bolt-builder-bolt-cli-$target-$OPENCODE_VERSION.tgz" -C "$work/cli/$target" package
  staging=$(mktemp -d)
  cp "$work/cli/$target/package/bin/opencode.exe" "$staging/bolt.exe"
  powershell -NoProfile -Command "Compress-Archive -Path '$(cygpath -w "$staging/bolt.exe")' -DestinationPath '$(cygpath -w "$out/bolt-cli-$target.zip")'"
  rm -rf "$staging"
done
