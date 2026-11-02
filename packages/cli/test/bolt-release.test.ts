import { expect, test } from "bun:test"
import { Schema } from "effect"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const release = path.resolve(import.meta.dir, "../../../.github/release")
const targets = [
  "linux-arm64",
  "linux-x64",
  "linux-x64-baseline",
  "linux-arm64-musl",
  "linux-x64-musl",
  "linux-x64-baseline-musl",
  "darwin-arm64",
  "darwin-x64",
  "darwin-x64-baseline",
  "windows-arm64",
  "windows-x64",
  "windows-x64-baseline",
]

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-release-"))
  const dirs = Object.fromEntries(
    await Promise.all(
      ["archives", "mac", "win", "linux", "arm", "npm", "temp", "bin", "tap"].map(async (name) => {
        const dir = path.join(root, name)
        await fs.mkdir(dir)
        return [name, dir] as const
      }),
    ),
  )
  // Isolate fixture commands from machine shell startup files so only the local recording executables run.
  const env = {
    ...process.env,
    BASH_ENV: "",
    PATH: `${dirs.bin}${path.delimiter}${process.env.PATH}`,
    RUNNER_TEMP: dirs.temp,
    OPENCODE_VERSION: "2.3.4",
    OPENCODE_CHANNEL: "latest",
    OPENCODE_NPM_TAG: "latest",
    OPENCODE_DRY_RUN: "true",
    OPENCODE_RELEASE_SHA: "a".repeat(40),
    CALLS: path.join(root, "calls"),
  }
  const run = async (script: string, args: string[], overrides: Record<string, string> = {}) => {
    const child = Bun.spawn(["bash", path.join(release, script), ...args], {
      cwd: root,
      env: { ...env, ...overrides },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, code }
  }
  const write = (dir: string, name: string, value = name) => fs.writeFile(path.join(dir, name), value)
  return { root, dirs, env, run, write, close: () => fs.rm(root, { recursive: true, force: true }) }
}

test("signed Bolt assets produce updater feeds with matching bytes, sizes and release URLs", async () => {
  const f = await fixture()
  try {
    const assets = [
      [f.dirs.mac, ["mac-arm64.zip", "mac-arm64.dmg", "mac-x64.zip", "mac-x64.dmg"]],
      [f.dirs.win, ["win-arm64.exe", "win-x64.exe"]],
      [f.dirs.linux, ["linux-x86_64.AppImage", "linux-amd64.deb", "linux-x86_64.rpm"]],
      [f.dirs.arm, ["linux-arm64.AppImage", "linux-arm64.deb", "linux-aarch64.rpm"]],
    ] as const
    for (const [dir, names] of assets) for (const name of names) await f.write(dir, `bolt-desktop-${name}`)
    for (const channel of ["latest", "dev", "beta"]) {
      expect(
        (
          await f.run("publish-desktop.sh", [f.dirs.mac, f.dirs.win, f.dirs.linux, f.dirs.arm], {
            OPENCODE_CHANNEL: channel,
          })
        ).code,
      ).toBe(0)
      for (const [suffix, count] of [
        ["", 2],
        ["-mac", 4],
        ["-linux", 3],
        ["-linux-arm64", 3],
      ] as const) {
        const feed = await Bun.file(path.join(f.dirs.temp, "desktop-feeds", `${channel}${suffix}.yml`)).json()
        expect(feed.version).toBe("2.3.4")
        expect(feed.files).toHaveLength(count)
        for (const file of feed.files) {
          const name = file.url.split("/").at(-1)
          const bytes = Buffer.from(name)
          expect(file.url).toBe(`https://github.com/bolt-builder/bolt-cli/releases/download/v2.3.4/${name}`)
          expect(file.sha512).toBe(createHash("sha512").update(bytes).digest("base64"))
          expect(file.size).toBe(bytes.length)
        }
      }
    }
    await fs.unlink(path.join(f.dirs.win, "bolt-desktop-win-x64.exe"))
    expect((await f.run("publish-desktop.sh", [f.dirs.mac, f.dirs.win, f.dirs.linux, f.dirs.arm])).code).toBe(1)
  } finally {
    await f.close()
  }
})

test("CLI archives and Homebrew formula agree with the Bolt installer and reject missing signed files", async () => {
  const f = await fixture()
  try {
    for (const target of targets)
      await f.write(
        target.startsWith("darwin") ? f.dirs.mac : target.startsWith("windows") ? f.dirs.win : f.dirs.archives,
        `bolt-cli-${target}${target.startsWith("linux") ? ".tar.gz" : ".zip"}`,
      )
    expect((await f.run("publish-cli.sh", [f.dirs.archives, f.dirs.mac, f.dirs.win])).code).toBe(0)
    expect(
      (await f.run("publish-cli.sh", [f.dirs.archives, f.dirs.mac, f.dirs.win], { OPENCODE_CHANNEL: "dev" })).code,
    ).toBe(1)
    for (const target of ["linux-arm64", "linux-x64", "darwin-arm64", "windows-arm64", "windows-x64"])
      await f.write(f.dirs.archives, `bolt-cli-node-${target}${target.startsWith("linux") ? ".tar.gz" : ".zip"}`)
    expect(
      (await f.run("publish-cli.sh", [f.dirs.archives, f.dirs.mac, f.dirs.win], { OPENCODE_CHANNEL: "dev" })).code,
    ).toBe(0)
    expect((await f.run("render-homebrew.sh", [f.dirs.mac, f.dirs.archives, f.dirs.tap])).code).toBe(0)
    const formula = await Bun.file(path.join(f.dirs.tap, "bolt-cli.rb")).text()
    for (const name of [
      "bolt-cli-darwin-arm64.zip",
      "bolt-cli-darwin-x64-baseline.zip",
      "bolt-cli-linux-arm64.tar.gz",
      "bolt-cli-linux-x64-baseline.tar.gz",
    ]) {
      expect(formula).toContain(`https://github.com/bolt-builder/bolt-cli/releases/download/v2.3.4/${name}`)
      expect(formula).toContain(createHash("sha256").update(name).digest("hex"))
    }
    expect(formula).toContain('bin.install "bolt"')
    await fs.unlink(path.join(f.dirs.mac, "bolt-cli-darwin-arm64.zip"))
    expect((await f.run("publish-cli.sh", [f.dirs.archives, f.dirs.mac, f.dirs.win])).code).toBe(1)
  } finally {
    await f.close()
  }
})

test("npm publication validates Bolt ownership, version, scripts and signed origins before running npm", async () => {
  const f = await fixture()
  try {
    await fs.writeFile(path.join(f.dirs.bin, "npm"), '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$CALLS"\n', {
      mode: 0o755,
    })
    const pack = async (name: string, overrides = {}, unsigned = false) => {
      const stage = path.join(f.root, "stage", "package")
      await fs.mkdir(stage, { recursive: true })
      await fs.writeFile(path.join(stage, "package.json"), JSON.stringify({ name, version: "2.3.4", ...overrides }))
      const out = path.join(
        unsigned
          ? f.dirs.npm
          : name.includes("darwin-")
            ? f.dirs.mac
            : name.includes("windows-")
              ? f.dirs.win
              : f.dirs.npm,
        `${name.replace(/[@/]/g, "-")}.tgz`,
      )
      const child = Bun.spawn(["tar", "-czf", path.basename(out), "-C", path.dirname(stage), "package"], {
        cwd: path.dirname(out),
        stdout: "ignore",
        stderr: "pipe",
      })
      expect(await child.exited).toBe(0)
      return out
    }
    await pack("@bolt-builder/bolt-cli", { scripts: { postinstall: "node postinstall.mjs" } })
    for (const target of targets) await pack(`@bolt-builder/bolt-cli-${target}`)
    await pack("@opencode/schema")
    const args = [f.dirs.npm, f.dirs.mac, f.dirs.win]
    expect(await f.run("publish-npm.sh", args)).toMatchObject({ code: 0 })
    const calls = (await Bun.file(f.env.CALLS).text()).trim().split("\n")
    expect(calls).toHaveLength(13)
    expect(calls.every((call) => call.includes("--ignore-scripts") && call.includes("--dry-run"))).toBe(true)
    expect(calls.at(-1)).toContain("/-bolt-builder-bolt-cli.tgz")
    const cases = [
      ["@other/bolt-cli", {}, false],
      ["@opencode/not-a-library", {}, false],
      ["@bolt-builder/bolt-cli-linux-x64", { version: "9.0.0" }, false],
      ["@bolt-builder/bolt-cli-linux-x64", { publishConfig: { registry: "https://invalid.example" } }, false],
      ["@bolt-builder/bolt-cli-linux-x64", { scripts: { install: "echo bad" } }, false],
    ] as const
    for (const [name, overrides, unsigned] of cases) {
      const file = await pack(name, overrides, unsigned)
      await fs.writeFile(f.env.CALLS, "")
      expect((await f.run("publish-npm.sh", args)).code).toBe(1)
      expect(await Bun.file(f.env.CALLS).text()).toBe("")
      await fs.unlink(file)
      if (name === "@bolt-builder/bolt-cli-linux-x64") await pack(name)
    }
    const signed = path.join(f.dirs.mac, "-bolt-builder-bolt-cli-darwin-arm64.tgz")
    await fs.unlink(signed)
    await pack("@bolt-builder/bolt-cli-darwin-arm64", {}, true)
    expect((await f.run("publish-npm.sh", args)).code).toBe(1)
  } finally {
    await f.close()
  }
})

test("GitHub publication requires verified tags and keeps preview releases off Latest", async () => {
  const f = await fixture()
  try {
    // This executable records arguments only. No remote command or publication occurs.
    await fs.writeFile(
      path.join(f.dirs.bin, "gh"),
      '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$CALLS"\nif [ "$2" = view ]; then exit 1; fi\n',
      { mode: 0o755 },
    )
    await f.write(f.dirs.archives, "bolt-cli-linux-x64.tar.gz")
    await f.write(f.dirs.archives, "latest.yml")
    await f.write(f.dirs.archives, "unrelated.tgz")
    expect((await f.run("publish-github-release.sh", [f.dirs.archives])).code).toBe(0)
    expect(await Bun.file(f.env.CALLS).exists()).toBe(false)
    for (const channel of ["latest", "dev", "beta"]) {
      await fs.writeFile(f.env.CALLS, "")
      expect(
        await f.run("publish-github-release.sh", [f.dirs.archives], {
          OPENCODE_CHANNEL: channel,
          OPENCODE_DRY_RUN: "false",
        }),
      ).toMatchObject({ code: 0 })
      const calls = await Bun.file(f.env.CALLS).text()
      expect(calls).toContain("--verify-tag")
      expect(calls).toContain(`--latest=${channel === "latest"}`)
      expect(calls).toContain(`--prerelease=${channel !== "latest"}`)
      expect(calls).toContain("SHA256SUMS")
      expect(calls).toContain("latest.yml")
      expect(calls).not.toContain("unrelated.tgz")
    }
  } finally {
    await f.close()
  }
})

test("preview tagging preserves the built tree and refuses to replace an existing release tag", async () => {
  const f = await fixture()
  const git = async (...args: string[]) => {
    const child = Bun.spawn(["git", ...args], { cwd: f.root, stdout: "pipe", stderr: "pipe" })
    const [text, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect({ code, error: code ? error : "" }).toEqual({ code: 0, error: "" })
    return text.trim()
  }
  try {
    await git("init", "-q")
    await git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "fixture",
      "--allow-empty",
    )
    await git("init", "--bare", "-q", path.join(f.root, "origin.git"))
    await git("remote", "add", "origin", path.join(f.root, "origin.git"))
    const sha = await git("rev-parse", "HEAD")
    const output = path.join(f.root, "output")
    const env = {
      OPENCODE_CHANNEL: "dev",
      OPENCODE_VERSION: "0.0.0-dev-123",
      OPENCODE_DRY_RUN: "false",
      GITHUB_OUTPUT: output,
    }
    expect((await f.run("tag-release.sh", [], env)).code).toBe(0)
    expect(await git("ls-remote", "origin", "refs/tags/v0.0.0-dev-123")).toBe(`${sha}\trefs/tags/v0.0.0-dev-123`)
    expect((await f.run("tag-release.sh", [], env)).code).toBe(0)
    expect(await git("rev-parse", "HEAD")).toBe(sha)
    expect(await Bun.file(output).text()).toContain(`sha=${sha}`)
    await git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "tag",
      "-a",
      "v0.0.0-dev-125",
      "-m",
      "annotated",
    )
    await git("push", "-q", "origin", "v0.0.0-dev-125")
    expect((await f.run("tag-release.sh", [], { ...env, OPENCODE_VERSION: "0.0.0-dev-125" })).code).toBe(0)
    await git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "new fixture",
      "--allow-empty",
    )
    expect((await f.run("tag-release.sh", [], env)).code).toBe(1)
    expect(await git("ls-remote", "origin", "refs/tags/v0.0.0-dev-123")).toBe(`${sha}\trefs/tags/v0.0.0-dev-123`)
    expect(
      (await f.run("tag-release.sh", [], { ...env, OPENCODE_VERSION: "0.0.0-dev-124", OPENCODE_DRY_RUN: "true" })).code,
    ).toBe(0)
    expect(await git("ls-remote", "origin", "refs/tags/v0.0.0-dev-124")).toBe("")
  } finally {
    await f.close()
  }
})

test("manual branch builds cannot enter release stages and existing release gates remain enforced", async () => {
  const f = await fixture()
  try {
    const output = path.join(f.root, "plan-output")
    const base = {
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_REF: "refs/heads/coderabbit/fixture",
      GITHUB_RUN_NUMBER: "123",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_OUTPUT: output,
      GITHUB_REPOSITORY: "bolt-builder/bolt-cli",
      GITHUB_ACTOR: "fixture",
      INPUT_BUMP: "minor",
      INPUT_VERSION: "",
      INPUT_RELEASE_NOTES: "",
      INPUT_BUILD_ONLY: "false",
    }
    const summary = path.join(f.root, "summary")
    const branch = await f.run("plan-release.sh", [], { ...base, GITHUB_STEP_SUMMARY: summary })
    expect(branch.code).toBe(0)
    expect(branch.stdout).toContain("temporary PR version")
    expect(await Bun.file(summary).text()).toContain("No version bump, tag, signing, or publishing")
    expect(await Bun.file(output).text()).toContain(
      "version=0.0.0-pr-123\nchannel=pr\nnpm_tag=pr\ndry_run=true\nbuild_only=true\ncli=true\ndesktop=true\nnode=true\nrelease=true",
    )
    await fs.rm(output)
    const dry = await f.run("plan-release.sh", [], { ...base, GITHUB_REF: "refs/heads/dev", INPUT_BUILD_ONLY: "true" })
    expect(dry.code).toBe(0)
    expect(dry.stdout).toContain("temporary PR version")
    expect(await Bun.file(output).text()).toContain("channel=pr\nnpm_tag=pr\ndry_run=true\nbuild_only=true")
    await fs.rm(output)
    const denied = await f.run("plan-release.sh", [], { ...base, GITHUB_REF: "refs/heads/beta" })
    expect(denied.code).toBe(1)
    expect(denied.stderr).toContain("cannot publish")
    expect(await Bun.file(output).exists()).toBe(false)
    const push = await f.run("plan-release.sh", [], {
      ...base,
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF: "refs/heads/dev",
      INPUT_BUMP: "",
      INPUT_BUILD_ONLY: "true",
    })
    expect(push.code).toBe(1)
    expect(push.stderr).toContain("only for manual runs")
    const preview = await f.run("plan-release.sh", [], {
      ...base,
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF: "refs/heads/dev",
      INPUT_BUMP: "",
    })
    expect(preview.code).toBe(0)
    expect(await Bun.file(output).text()).toContain("channel=dev\nnpm_tag=dev\ndry_run=false\nbuild_only=false")
    await fs.rm(output)
    const missingNotes = await f.run("plan-release.sh", [], { ...base, GITHUB_REF: "refs/heads/dev" })
    expect(missingNotes.code).toBe(1)
    expect(missingNotes.stderr).toContain("release notes")
    await fs.writeFile(path.join(f.dirs.bin, "gh"), '#!/usr/bin/env bash\nprintf "read\\n"\n', { mode: 0o755 })
    const unauthorized = await f.run("plan-release.sh", [], {
      ...base,
      GITHUB_REF: "refs/heads/dev",
      INPUT_RELEASE_NOTES: "Reviewed fixture notes",
    })
    expect(unauthorized.code).toBe(1)
    expect(unauthorized.stderr).toContain("admin or maintain")
    expect(await Bun.file(output).exists()).toBe(false)
    await fs.writeFile(path.join(f.dirs.bin, "gh"), '#!/usr/bin/env bash\nprintf "maintain\n"\n', { mode: 0o755 })
    await fs.writeFile(path.join(f.dirs.bin, "curl"), '#!/usr/bin/env bash\nprintf "404"\n', { mode: 0o755 })
    const stable = await f.run("plan-release.sh", [], {
      ...base,
      GITHUB_REF: "refs/heads/dev",
      INPUT_VERSION: "2.3.5",
      INPUT_RELEASE_NOTES: "Reviewed fixture notes",
    })
    expect(stable.code).toBe(0)
    expect(await Bun.file(output).text()).toContain(
      "version=2.3.5\nchannel=latest\nnpm_tag=latest\ndry_run=false\nbuild_only=false",
    )
    await fs.rm(output)
    const beta = await f.run("plan-release.sh", [], {
      ...base,
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF: "refs/heads/beta",
      INPUT_BUMP: "",
    })
    expect(beta.code).toBe(0)
    expect(await Bun.file(output).text()).toContain("channel=beta\nnpm_tag=\ndry_run=false\nbuild_only=false")
    await fs.rm(output)
    const pr = await f.run("plan-release.sh", [], {
      ...base,
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_REF: "refs/pull/420/merge",
      INPUT_BUMP: "",
    })
    expect(pr.code).toBe(0)
    expect(await Bun.file(output).text()).toContain("channel=pr\nnpm_tag=pr\ndry_run=true\nbuild_only=false")

    const workflow = Schema.decodeUnknownSync(
      Schema.Struct({
        jobs: Schema.Record(
          Schema.String,
          Schema.Struct({
            if: Schema.optional(Schema.String),
            outputs: Schema.optional(Schema.Record(Schema.String, Schema.String)),
            steps: Schema.optional(Schema.Array(Schema.Struct({ if: Schema.optional(Schema.String) }))),
          }),
        ),
      }),
    )(Bun.YAML.parse(await Bun.file(path.resolve(release, "../workflows/release.yml")).text()))
    const jobs = workflow.jobs
    expect(jobs.plan.outputs?.build_only).toContain("steps.plan.outputs.build_only")
    expect(jobs.tag.outputs?.sha).toContain("github.sha")
    expect(jobs.tag.steps?.filter((step) => step.if?.includes("build_only != 'true'"))).toHaveLength(2)
    for (const name of [
      "build-desktop-windows-installer",
      "sign-macos",
      "sign-windows",
      "sign-desktop-windows-installer",
      "publish-attestations",
      "publish-npm",
      "publish-cli",
      "publish-desktop",
      "publish-docker",
      "publish-homebrew",
      "publish-github-release",
      "publish-discord",
      "publish-version-pr",
    ]) {
      expect(jobs[name].if).toContain("needs.plan.outputs.build_only != 'true'")
    }
    for (const name of ["build-cli", "build-node", "build-npm", "build-desktop", "build-docker"]) {
      expect(jobs[name].if ?? "").not.toContain("build_only != 'true'")
    }
  } finally {
    await f.close()
  }
})
