#!/usr/bin/env bash
# publish-github-release.sh <dir>...: attaches the CLI archives and desktop builds in the given artifact dirs, plus
# a SHA256SUMS, to the v<version> GitHub release with OPENCODE_RELEASE_NOTES. Immutable releases lock assets once
# published, so they go to a draft first.
. "$(dirname "$0")/lib.sh"

assets=$(mktemp -d)
trap 'rm -rf "$assets" "$assets.md"' EXIT
for dir in "$@"; do
  find "$dir" -maxdepth 1 -type f \( -name 'bolt-cli-*.zip' -o -name 'bolt-cli-*.tar.gz' -o -name 'bolt-desktop-*' -o -name '*.yml' \) \
    ! -name '*.tgz' ! -name '*.app.tar' -exec cp {} "$assets/" \;
done
(cd "$assets" && sha256 -- * > SHA256SUMS && cat SHA256SUMS)
printf '%s\n' "${OPENCODE_RELEASE_NOTES:-}" > "$assets.md"
if dry_run; then exit 0; fi

tag="v$OPENCODE_VERSION"
# Stable Bolt V2 releases become Latest; preview releases keep their own channel.
latest=false prerelease=true
if [ "$OPENCODE_CHANNEL" = latest ]; then
  latest=true prerelease=false
fi
gh release view "$tag" > /dev/null 2>&1 ||
  gh release create "$tag" --draft --verify-tag --latest="$latest" --prerelease="$prerelease" --title "$tag" --notes-file "$assets.md"
gh release upload "$tag" "$assets"/* --clobber
gh release edit "$tag" --draft=false --latest="$latest" --prerelease="$prerelease"
