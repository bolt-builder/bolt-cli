#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"
import { fileURLToPath } from "url"

console.log("=== publishing ===\n")

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)
const tag = `v${Script.version}`

const pkgjsons = await Array.fromAsync(
  new Bun.Glob("**/package.json").scan({
    absolute: true,
  }),
).then((arr) => arr.filter((x) => !x.includes("node_modules") && !x.includes("dist")))

async function prepareReleaseFiles() {
  for (const file of pkgjsons) {
    let pkg = await Bun.file(file).text()
    pkg = pkg.replaceAll(/"version": "[^"]+"/g, `"version": "${Script.version}"`)
    console.log("updated:", file)
    await Bun.file(file).write(pkg)
  }

  await $`bun install`
  await $`./packages/sdk/js/script/build.ts`
}

if (Script.release && !Script.preview) {
  await $`git fetch origin --tags`
  await $`git switch --detach`
}

await prepareReleaseFiles()

console.log("\n=== cli ===\n")
await $`bun ./packages/opencode/script/publish.ts`

// The preview cli, sdk, plugin, and ui packages still publish under the
// `@opencode-ai` npm scope, which Bolt does not own; publishing them would fail
// with the bolt-builder token. Re-enable once they are rebranded to a scope we own.
console.log("\n=== preview cli / sdk / plugin / ui: skipped (@opencode-ai scope not owned) ===\n")

if (Script.release) {
  // latest.json signs update artifacts with the Tauri updater key. When
  // TAURI_SIGNING_PRIVATE_KEY is missing or invalid, skip the desktop updater
  // feed instead of failing the whole release: the release still ships, the
  // desktop app just won't see this version via auto-update.
  const feed = await $`bun ./packages/desktop/scripts/finalize-latest-json.ts`.nothrow()
  if (feed.exitCode !== 0) {
    console.warn(feed.stdout.toString())
    console.warn(feed.stderr.toString())
    console.warn(
      "::warning::skipping desktop updater feed: finalize-latest-json failed (missing or invalid TAURI_SIGNING_PRIVATE_KEY?)",
    )
  }
  // latest.yml uses electron-updater's embedded sha512 checksums and needs no signing key.
  await $`bun ./packages/desktop/scripts/finalize-latest-yml.ts`
}

if (Script.release && !Script.preview) {
  // When dev already carries the release versions (e.g. a rerun after a
  // partially failed publish), prepareReleaseFiles leaves the tree clean and
  // an unconditional `git commit` would fail with "nothing to commit".
  if (await $`git status --porcelain --untracked-files=no`.text()) await $`git commit -am "release: ${tag}"`
  // Bare --force-with-lease can never move an existing tag: tags have no
  // remote-tracking refs, so git rejects the push with "stale info". Pin the
  // lease to the tag value fetched at the start of this run instead. New tags
  // get an empty expectation (remote ref must not exist), and re-dispatching a
  // failed publish moves its own tag, while a tag moved concurrently by
  // another run still fails the lease.
  const prior = (await $`git rev-parse --verify refs/tags/${tag}`.nothrow().quiet().text()).trim()
  await $`git tag -d ${tag}`.nothrow()
  await $`git tag ${tag}`
  await $`git push origin refs/tags/${tag} --force-with-lease=refs/tags/${tag}:${prior} --no-verify`
  await new Promise((resolve) => setTimeout(resolve, 5_000))
  await $`git fetch origin`
  await $`git checkout -B dev origin/dev`
  await prepareReleaseFiles()
  // [skip ci] keeps this push from re-triggering the publish workflow: dev is
  // a publish trigger branch, so without it every release spawns a follow-up
  // publish run that can race the next dispatched release on the tag push.
  if (await $`git status --porcelain --untracked-files=no`.text())
    await $`git commit -am "sync release versions for ${tag} [skip ci]"`
  await $`git push origin HEAD:dev --no-verify`
}

if (Script.release) {
  await $`gh release edit ${tag} --draft=false --repo ${process.env.GH_REPO}`
}
