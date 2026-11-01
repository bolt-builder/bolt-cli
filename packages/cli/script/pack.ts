#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@opencode/script"
import { archiveDir, npmDir } from "@opencode/script/pack"
import { existsSync } from "fs"
import { chmod, copyFile, mkdir, mkdtemp, rm, utimes } from "node:fs/promises"
import path from "node:path"
import os from "node:os"

// Packs the built CLI (dist/) into npm tarballs in dist/npm and standalone archives in dist/archives at
// the repository root. The release workflow signs the macOS and Windows packages and archives afterwards.
const dir = path.resolve(import.meta.dir, "..")
const root = path.join(dir, "dist")
process.chdir(dir)
await mkdir(npmDir, { recursive: true })
await mkdir(archiveDir, { recursive: true })

await packDistribution({
  root,
  name: "@bolt-builder/bolt-cli",
  command: "bolt",
  legacyCommand: "opencode",
  binary: "opencode",
  packagePrefix: "@bolt-builder/bolt-cli-",
  archive: () => true,
})
if (existsSync(path.join(root, "node"))) {
  await packDistribution({
    root: path.join(root, "node"),
    name: "@bolt-builder/bolt-cli-node",
    command: "bolt-node",
    binary: "opencode2-node",
    packagePrefix: "@bolt-builder/bolt-cli-node-",
    archive: () => true,
  })
}

async function packDistribution(input: {
  root: string
  name: string
  command: string
  legacyCommand?: string
  binary: string
  packagePrefix: string
  archive: (target: string) => boolean
}) {
  const binaries: Record<string, string> = {}
  const directories: Record<string, string> = {}
  for (const filepath of new Bun.Glob("*/package.json").scanSync({ cwd: input.root })) {
    const item = await Bun.file(`${input.root}/${filepath}`).json()
    if (!item.name.startsWith(input.packagePrefix)) continue
    binaries[item.name] = item.version
    directories[item.name] = path.dirname(filepath)
  }
  console.log(input.name, "binaries", binaries)
  const versions = new Set(Object.values(binaries))
  if (versions.size > 1) throw new Error(`Binary package versions do not match for ${input.name}`)
  const version = versions.values().next().value
  if (!version) throw new Error(`No binary packages found for ${input.name}`)
  if (version !== Script.version) throw new Error(`Expected ${Script.version}, got ${version} for ${input.name}`)

  await $`mkdir -p ${input.root}/${input.name}/bin`
  await $`cp ./script/postinstall.mjs ${input.root}/${input.name}/postinstall.mjs`
  await Bun.file(`${input.root}/${input.name}/bin/${input.command}.exe`).write(
    [
      `echo "Error: ${input.name}'s postinstall script was not run." >&2`,
      'echo "" >&2',
      'echo "This occurs when installation scripts are disabled." >&2',
      'echo "Run the package postinstall script or reinstall with scripts enabled." >&2',
      "exit 1",
      "",
    ].join("\n"),
  )
  await Bun.file(`${input.root}/${input.name}/package.json`).write(
    JSON.stringify(
      {
        name: input.name,
        bin: {
          [input.command]: `./bin/${input.command}.exe`,
          ...(input.legacyCommand ? { [input.legacyCommand]: `./bin/${input.command}.exe` } : {}),
        },
        ...(input.command !== input.binary ? { opencodeSourceBinary: input.binary } : {}),
        scripts: { postinstall: "node ./postinstall.mjs" },
        version,
        license: pkg.license,
        repository: { type: "git", url: "git+https://github.com/bolt-builder/bolt-cli.git" },
        os: ["darwin", "linux", "win32"],
        cpu: ["arm64", "x64"],
        optionalDependencies: binaries,
      },
      null,
      2,
    ),
  )

  await Promise.all(Object.keys(binaries).map((name) => pack(path.join(input.root, directories[name]))))
  await pack(`${input.root}/${input.name}`)
  await Promise.all(
    Object.keys(binaries)
      .map((name) => name.slice(input.packagePrefix.length))
      .filter(input.archive)
      .map((target) =>
        archive(
          path.join(input.root, directories[`${input.packagePrefix}${target}`], "bin"),
          target,
          input.binary,
          input.command,
          input.name.split("/").at(-1)!,
        ),
      ),
  )
}

async function pack(directory: string) {
  if (process.platform !== "win32") await $`chmod -R 755 .`.cwd(directory)
  await $`bun pm pack --destination ${npmDir}`.cwd(directory)
}

async function archive(bin: string, target: string, binary: string, command: string, name: string) {
  const suffix = target.startsWith("windows-") ? ".exe" : ""
  const executable = `${command}${suffix}`
  const original = path.join(bin, `${binary}${suffix}`)
  if (!(await Bun.file(original).exists()) || !Bun.file(original).size) throw new Error(`Missing binary: ${original}`)
  const staging = await mkdtemp(path.join(os.tmpdir(), "bolt-archive-"))
  try {
    const source = path.join(staging, executable)
    await copyFile(original, source)
    // Artifact downloads lose execute bits. Fixed timestamps make retries reproducible.
    await chmod(source, 0o755)
    await utimes(source, new Date("1980-01-01T00:00:00Z"), new Date("1980-01-01T00:00:00Z"))
    const extension = target.startsWith("linux-") ? "tar.gz" : "zip"
    const output = path.join(archiveDir, `${name}-${target}.${extension}`)
    await rm(output, { force: true })
    if (extension === "tar.gz")
      await $`tar --mtime=@0 --owner=0 --group=0 --numeric-owner -czf ${output} -C ${staging} ${executable}`
    if (extension === "zip") await $`zip -X -q ${output} ${executable}`.cwd(staging)
    return output
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}
