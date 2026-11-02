#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@opencode/script"
import { archiveDir, npmDir } from "@opencode/script/pack"
import { existsSync } from "fs"
import { mkdir } from "node:fs/promises"
import { createReadStream, createWriteStream } from "node:fs"
import { Readable, Writable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { createGzip } from "node:zlib"
import { BlobReader, ZipWriter } from "@zip.js/zip.js"
import path from "node:path"

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
  const file = Bun.file(original)
  if (!(await file.exists()) || !file.size) throw new Error(`Missing binary: ${original}`)
  const extension = target.startsWith("linux-") ? "tar.gz" : "zip"
  const output = path.join(archiveDir, `${name}-${target}.${extension}`)
  if (extension === "tar.gz") {
    // A CLI archive contains exactly one regular file. Emit a portable USTAR header
    // with fixed ownership, time and executable mode, independently of the build host.
    // Stream the binary so packing never needs a second full copy in memory.
    if (file.size >= 8 ** 11) throw new Error(`Binary exceeds the USTAR size limit: ${original}`)
    const header = Buffer.alloc(512)
    header.write(executable, 0, 100, "ascii")
    header.write("0000755\0", 100, "ascii")
    header.write("0000000\0", 108, "ascii")
    header.write("0000000\0", 116, "ascii")
    header.write(file.size.toString(8).padStart(11, "0") + "\0", 124, "ascii")
    header.write("00000000000\0", 136, "ascii")
    header.fill(32, 148, 156)
    header.write("0", 156, "ascii")
    header.write("ustar\0", 257, "ascii")
    header.write("00", 263, "ascii")
    header.write(
      header
        .reduce((sum, byte) => sum + byte, 0)
        .toString(8)
        .padStart(6, "0") + "\0 ",
      148,
      "ascii",
    )
    await pipeline(
      Readable.from(
        (async function* () {
          yield header
          yield* createReadStream(original)
          yield Buffer.alloc(((512 - (file.size % 512)) % 512) + 1024)
        })(),
      ),
      createGzip(),
      createWriteStream(output),
    )
    return output
  }
  // Native zip is absent on Windows runners. The same codec writes both host
  // targets, with no machine timestamps and with Unix execute bits for macOS.
  const stream = createWriteStream(output)
  // Node's web-stream adapter implements the standard writable interface consumed by zip.js.
  const writer = new ZipWriter(Writable.toWeb(stream) as unknown as WritableStream<Uint8Array>, {
    extendedTimestamp: false,
  })
  await writer.add(executable, new BlobReader(file), {
    useWebWorkers: false,
    lastModDate: new Date("1980-01-01T00:00:00Z"),
    externalFileAttributes: 0o100755 << 16,
    msDosCompatible: false,
  })
  await writer.close()
  return output
}
