#!/usr/bin/env bash
# render-homebrew.sh <sign-macos dir> <build-archives dir> <tap dir>: writes Formula bolt-cli.rb with the
# hashes of the signed macOS and the Linux archives.
. "$(dirname "$0")/lib.sh"

macos=$1 archives=$2 tap=$3
sum() { sha256 "$1" | cut -c1-64; }
base="https://github.com/bolt-builder/bolt-cli/releases/download/v$OPENCODE_VERSION"
cat > "$tap/bolt-cli.rb" <<FORMULA
# typed: false
# frozen_string_literal: true

class BoltCli < Formula
  desc "Bolt V2 - the AI coding agent for the terminal"
  homepage "https://github.com/bolt-builder/bolt-cli"
  version "$OPENCODE_VERSION"
  license "MIT"

  depends_on "ripgrep"

  on_macos do
    if Hardware::CPU.arm?
      url "$base/bolt-cli-darwin-arm64.zip"
      sha256 "$(sum "$macos/bolt-cli-darwin-arm64.zip")"
    else
      url "$base/bolt-cli-darwin-x64-baseline.zip"
      sha256 "$(sum "$macos/bolt-cli-darwin-x64-baseline.zip")"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "$base/bolt-cli-linux-arm64.tar.gz"
      sha256 "$(sum "$archives/bolt-cli-linux-arm64.tar.gz")"
    else
      url "$base/bolt-cli-linux-x64-baseline.tar.gz"
      sha256 "$(sum "$archives/bolt-cli-linux-x64-baseline.tar.gz")"
    end
  end

  def install
    bin.install "bolt"
  end
end
FORMULA
cat "$tap/bolt-cli.rb"
