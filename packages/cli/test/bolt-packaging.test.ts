import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

// Exercises the actual pack script with synthetic binaries and private output directories.
// It does not publish packages, execute an installer from the network, or claim native build readiness.
test("Bolt npm packages and archives match the existing installer and survive repeat packing", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-pack-"))
  const cli = path.join(root, "packages", "cli")
  const npm = path.join(root, "output", "npm")
  const archives = path.join(root, "output", "archives")
  const run = async (args: string[], cwd = root) => {
    const child = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect({ code, stderr: code === 0 ? "" : stderr }).toEqual({ code: 0, stderr: "" })
    return stdout
  }
  try {
    await fs.mkdir(path.join(cli, "script"), { recursive: true })
    await fs.copyFile(path.join(import.meta.dir, "../script/pack.ts"), path.join(cli, "script/pack.ts"))
    await fs.copyFile(path.join(import.meta.dir, "../script/postinstall.mjs"), path.join(cli, "script/postinstall.mjs"))
    await fs.writeFile(path.join(cli, "package.json"), JSON.stringify({ name: "@opencode/cli", license: "MIT" }))
    const script = path.join(root, "node_modules", "@opencode", "script")
    await fs.mkdir(script, { recursive: true })
    await fs.writeFile(
      path.join(script, "package.json"),
      JSON.stringify({
        name: "@opencode/script",
        type: "module",
        exports: { ".": "./index.ts", "./pack": "./pack.ts" },
      }),
    )
    await fs.writeFile(path.join(script, "index.ts"), 'export const Script = { version: "2.3.4" }\n')
    await fs.writeFile(
      path.join(script, "pack.ts"),
      `export const npmDir = ${JSON.stringify(npm)}; export const archiveDir = ${JSON.stringify(archives)}\n`,
    )
    for (const target of ["linux-x64", "darwin-arm64", "windows-x64"]) {
      const directory = path.join(cli, "dist", `cli-${target}`)
      await fs.mkdir(path.join(directory, "bin"), { recursive: true })
      await fs.writeFile(
        path.join(directory, "package.json"),
        JSON.stringify({ name: `@bolt-builder/bolt-cli-${target}`, version: "2.3.4" }),
      )
      await fs.writeFile(
        path.join(directory, "bin", target.startsWith("windows") ? "opencode.exe" : "opencode"),
        '#!/usr/bin/env node\nconsole.log("Bolt fixture " + process.argv.slice(2).join(" "))\n',
      )
    }
    await run([process.execPath, "run", "script/pack.ts"], cli)
    expect((await fs.readdir(archives)).sort()).toEqual([
      "bolt-cli-darwin-arm64.zip",
      "bolt-cli-linux-x64.tar.gz",
      "bolt-cli-windows-x64.zip",
    ])
    expect((await run(["tar", "-tzf", path.join(archives, "bolt-cli-linux-x64.tar.gz")])).trim()).toBe("bolt")
    expect((await run(["unzip", "-Z1", path.join(archives, "bolt-cli-darwin-arm64.zip")])).trim()).toBe("bolt")
    expect((await run(["unzip", "-Z1", path.join(archives, "bolt-cli-windows-x64.zip")])).trim()).toBe("bolt.exe")
    const digest = createHash("sha256")
      .update(await fs.readFile(path.join(archives, "bolt-cli-linux-x64.tar.gz")))
      .digest("hex")
    await run([process.execPath, "run", "script/pack.ts"], cli)
    expect(
      createHash("sha256")
        .update(await fs.readFile(path.join(archives, "bolt-cli-linux-x64.tar.gz")))
        .digest("hex"),
    ).toBe(digest)
    expect(await fs.readdir(path.join(cli, "dist", "cli-linux-x64", "bin"))).toEqual(["opencode"])
    const install = path.join(root, "install", "node_modules", "@bolt-builder")
    for (const name of ["bolt-cli", "bolt-cli-linux-x64"]) {
      const directory = path.join(install, name)
      await fs.mkdir(directory, { recursive: true })
      await run([
        "tar",
        "-xzf",
        path.join(npm, `bolt-builder-${name}-2.3.4.tgz`),
        "--strip-components=1",
        "-C",
        directory,
      ])
    }
    const wrapper = path.join(install, "bolt-cli")
    const manifest = JSON.parse(await fs.readFile(path.join(wrapper, "package.json"), "utf8"))
    expect(manifest.name).toBe("@bolt-builder/bolt-cli")
    expect(Object.keys(manifest.bin)).toEqual(["bolt", "opencode"])
    expect(manifest.repository.url).toBe("git+https://github.com/bolt-builder/bolt-cli.git")
    expect(manifest.optionalDependencies["@bolt-builder/bolt-cli-linux-x64"]).toBe("2.3.4")
    if (process.platform === "linux" && process.arch === "x64") {
      await run(["node", "postinstall.mjs"], wrapper)
      expect((await run(["node", "bin/bolt.exe", "--version"], wrapper)).trim()).toBe("Bolt fixture --version")
    }
    const installer = await fs.readFile(path.join(import.meta.dir, "../../../install"), "utf8")
    expect(installer).toContain('filename="bolt-cli-$target$archive_ext"')
    expect(installer).toContain('binary="bolt"')
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
