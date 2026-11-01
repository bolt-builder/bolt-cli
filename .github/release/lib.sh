# Shared helpers for the release scripts. Sourced, never executed.
#
# These scripts run in sign and publish jobs that hold secrets. They must never execute repository code
# or artifact contents: artifacts are data, and every value that names a destination comes from the
# environment the workflow sets (OPENCODE_VERSION, OPENCODE_CHANNEL, OPENCODE_DRY_RUN, ...).

set -euo pipefail
# Without this, set -e does not apply inside $(...), so a failing command in a function called as
# a command substitution is ignored. macOS /bin/bash is 3.2, which lacks the option.
if [ "${BASH_VERSINFO[0]}" -gt 4 ] || { [ "${BASH_VERSINFO[0]}" = 4 ] && [ "${BASH_VERSINFO[1]}" -ge 4 ]; }; then
  shopt -s inherit_errexit
fi

# shellcheck disable=SC2034 # used by the scripts that source this file
release_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

die() {
  echo "::error::$*" >&2
  exit 1
}

dry_run() {
  [ "${OPENCODE_DRY_RUN:-false}" = true ]
}

sha256() {
  if command -v sha256sum > /dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi
}

# Windows runners pass D:\a\_temp style paths; Git Bash tools want /d/a/_temp.
posix() {
  if command -v cygpath > /dev/null; then cygpath -u "$1"; else printf '%s' "$1"; fi
}

size() {
  wc -c < "$1" | tr -d ' '
}

# Clones a repository, lets a render script fill it, then commits and pushes any change:
# push_git <clone url> <commit message> <render script> [args...]. Dry runs render into an empty directory.
push_git() {
  local url=$1 message=$2 dir
  shift 2
  dir=$(mktemp -d)
  if ! dry_run; then git clone -q "$url" "$dir"; fi
  "$@" "$dir"
  if dry_run; then return; fi
  git -C "$dir" add -A
  if git -C "$dir" diff --cached --quiet; then return; fi
  git -C "$dir" -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -q -m "$message"
  git -C "$dir" push -q origin HEAD:master
}
