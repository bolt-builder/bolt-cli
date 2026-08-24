import { describe, expect, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { cleanShellConfig, formatSize, shortenPath } from "../../src/cli/cmd/uninstall"

describe("uninstall formatSize", () => {
  test("formats byte ranges", () => {
    expect(formatSize(512)).toBe("512 B")
    expect(formatSize(2048)).toBe("2.0 KB")
    expect(formatSize(3 * 1024 * 1024)).toBe("3.0 MB")
    expect(formatSize(5 * 1024 * 1024 * 1024)).toBe("5.0 GB")
  })
})

describe("uninstall shortenPath", () => {
  test("replaces the home prefix with a tilde", () => {
    expect(shortenPath(path.join(os.homedir(), "x"))).toBe(path.join("~", "x"))
    expect(shortenPath("/etc/hosts")).toBe("/etc/hosts")
  })
})

describe("uninstall cleanShellConfig", () => {
  test("removes bolt PATH blocks and standalone exports", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bolt-uninstall-")), ".bashrc")
    fs.writeFileSync(
      file,
      [
        "alias ll='ls -la'",
        "# bolt",
        'export PATH="$HOME/.bolt/bin:$PATH"',
        'export PATH="$HOME/.opencode/bin:$PATH"',
        "",
      ].join("\n"),
    )
    await cleanShellConfig(file)
    const content = fs.readFileSync(file, "utf8")
    expect(content).toContain("alias ll")
    expect(content).not.toContain(".bolt/bin")
    expect(content).not.toContain(".opencode/bin")
    expect(content).not.toContain("# bolt")
  })

  test("keeps unrelated lines untouched", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bolt-uninstall-")), ".zshrc")
    fs.writeFileSync(file, ['export PATH="$HOME/other/bin:$PATH"', "alias g=git"].join("\n"))
    await cleanShellConfig(file)
    const content = fs.readFileSync(file, "utf8")
    expect(content).toContain("other/bin")
    expect(content).toContain("alias g=git")
  })
})
